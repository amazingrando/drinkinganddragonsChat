import { NextRequest, NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { broadcastMessage } from "@/lib/supabase/server-broadcast"

export async function POST(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    const profile = await currentProfile()
    const { messageId } = await params
    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get("serverId")
    const channelId = searchParams.get("channelId")
    const { emoji }: { emoji?: string } = await request.json()

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!serverId) {
      return NextResponse.json({ error: "Server ID is required" }, { status: 400 })
    }
    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 })
    }
    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 })
    }

    const server = await db.server.findFirst({
      where: {
        id: serverId,
        members: { some: { profileID: profile.id } },
      },
      include: { members: true },
    })
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 })
    }

    const channel = await db.channel.findFirst({
      where: { id: channelId, serverID: serverId },
    })
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 })
    }

    const member = server.members.find(m => m.profileID === profile.id)
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const message = await db.message.findFirst({
      where: { id: messageId, channelId: channelId },
      include: { 
        member: { include: { profile: true } },
        reactions: {
          include: {
            member: {
              include: {
                profile: true
              }
            }
          }
        }
      },
    })
    if (!message || message.deleted) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if reaction already exists
    const existingReaction = await db.messageReaction.findFirst({
      where: {
        messageId: messageId,
        memberId: member.id,
        emoji: emoji,
      },
    })

    let updatedMessage
    if (existingReaction) {
      // Remove reaction (toggle off)
      await db.messageReaction.delete({
        where: { id: existingReaction.id },
      })
    } else {
      // Add reaction
      await db.messageReaction.create({
        data: {
          emoji: emoji,
          messageId: messageId,
          memberId: member.id,
        },
      })
    }

    // Fetch updated message with all reactions
    updatedMessage = await db.message.findFirst({
      where: { id: messageId },
      include: { 
        member: { include: { profile: true } },
        poll: {
          include: {
            options: {
              include: {
                votes: {
                  include: {
                    member: {
                      include: {
                        profile: true
                      }
                    }
                  }
                }
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
            creator: {
              include: {
                profile: true
              }
            }
          }
        },
        reactions: {
          include: {
            member: {
              include: {
                profile: true
              }
            }
          }
        }
      },
    })

    if (!updatedMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Broadcast the updated message
    const updateKey = `chat:${channelId}:messages:update`
    try {
      await broadcastMessage(updateKey, updateKey, updatedMessage)
    } catch (error) {
      console.log("[SUPABASE_BROADCAST_ERROR]", error)
    }

    return NextResponse.json(updatedMessage, { status: 200 })
  } catch (error) {
    console.error("[MESSAGE_REACTION_REQUEST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


