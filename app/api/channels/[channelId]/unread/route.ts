import { NextRequest, NextResponse } from "next/server"

import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"

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
      return NextResponse.json({ unreadCount: 0, lastMessageId: null }, { status: 200 })
    }

    const hasUnread = !readState || latestMessage.createdAt > readState.lastReadAt

    if (!hasUnread) {
      return NextResponse.json({ unreadCount: 0, lastMessageId: latestMessage.id }, { status: 200 })
    }

    const unreadCount = await db.message.count({
      where: {
        channelId,
        ...(readState?.lastReadAt
          ? {
              createdAt: {
                gt: readState.lastReadAt,
              },
            }
          : {}),
      },
    })

    return NextResponse.json({ unreadCount, lastMessageId: latestMessage.id }, { status: 200 })
  } catch (error) {
    console.error("[CHANNEL_UNREAD_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

