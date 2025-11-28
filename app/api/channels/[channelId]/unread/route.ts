import { NextRequest, NextResponse } from "next/server"

import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { parseMarkdown } from "@/lib/markdown/parser"

export async function GET(request: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const profile = await currentProfile()
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { channelId } = await params
    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) {
      return NextResponse.json({ error: "Server ID is required" }, { status: 400 })
    }

    const member = await db.member.findFirst({
      where: {
        serverID: serverId,
        profileID: profile.id,
      },
    })

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        serverID: serverId,
      },
    })

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 })
    }

    const [readState, latestMessage] = await Promise.all([
      db.channelReadState.findUnique({
        where: {
          memberId_channelId: {
            memberId: member.id,
            channelId,
          },
        },
      }),
      db.message.findFirst({
        where: { channelId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
        },
      }),
    ])

    if (!latestMessage) {
      return NextResponse.json({ unreadCount: 0, mentionCount: 0, lastMessageId: null }, { status: 200 })
    }

    const hasUnread = !readState || latestMessage.createdAt > readState.lastReadAt

    if (!hasUnread) {
      return NextResponse.json({ unreadCount: 0, mentionCount: 0, lastMessageId: latestMessage.id }, { status: 200 })
    }

    // Get all unread messages to count mentions
    const unreadMessages = await db.message.findMany({
      where: {
        channelId,
        deleted: false,
        ...(readState?.lastReadAt
          ? {
              createdAt: {
                gt: readState.lastReadAt,
              },
            }
          : {}),
      },
      select: {
        content: true,
      },
    })

    const unreadCount = unreadMessages.length

    // Count mentions of the current user in unread messages
    // Note: Mentions store member IDs, not profile IDs
    let mentionCount = 0
    for (const message of unreadMessages) {
      const tokens = parseMarkdown(message.content)
      
      // Recursively check all tokens for user mentions
      const checkTokens = (tokens: ReturnType<typeof parseMarkdown>) => {
        for (const token of tokens) {
          if (token.type === "mention" && token.mentionType === "user" && token.mentionId === member.id) {
            mentionCount++
          } else if (token.type === "bold" || token.type === "italic" || token.type === "spoiler" || token.type === "quote") {
            // Recursively check nested tokens
            checkTokens(token.content)
          }
        }
      }
      
      checkTokens(tokens)
    }

    return NextResponse.json({ unreadCount, mentionCount, lastMessageId: latestMessage.id }, { status: 200 })
  } catch (error) {
    console.error("[CHANNEL_UNREAD_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

