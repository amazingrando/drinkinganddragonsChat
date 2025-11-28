import { NextRequest, NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { broadcastMessage } from "@/lib/supabase/server-broadcast"
import { rateLimitPresets } from "@/lib/rate-limit"
import { secureErrorResponse } from "@/lib/error-handling"

const MAX_PINNED_MESSAGES = 50

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.lenient(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get("serverId")
    const channelId = searchParams.get("channelId")
    const { messageId } = await params

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!serverId) {
      return NextResponse.json({ error: "Server ID is required" }, { status: 400 })
    }
    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 })
    }

    // Verify server and channel access
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

    // Fetch the message
    const message = await db.message.findFirst({
      where: { id: messageId, channelId: channelId },
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
                        profile: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
            creator: {
              include: {
                profile: true,
              },
            },
          },
        },
        reactions: {
          include: {
            member: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    })

    if (!message || message.deleted) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const isPinned = message.pinned
    let updatedMessage

    if (isPinned) {
      // Unpin the message
      updatedMessage = await db.message.update({
        where: { id: messageId },
        data: {
          pinned: false,
          pinnedAt: null,
          pinnedBy: null,
        },
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
                          profile: true,
                        },
                      },
                    },
                  },
                },
                orderBy: {
                  createdAt: 'asc',
                },
              },
              creator: {
                include: {
                  profile: true,
                },
              },
            },
          },
          reactions: {
            include: {
              member: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      })
    } else {
      // Pin the message - check limit first
      const pinnedCount = await db.message.count({
        where: {
          channelId: channelId,
          pinned: true,
        },
      })

      // If at limit, unpin the oldest pinned message
      if (pinnedCount >= MAX_PINNED_MESSAGES) {
        const oldestPinned = await db.message.findFirst({
          where: {
            channelId: channelId,
            pinned: true,
          },
          orderBy: {
            pinnedAt: 'asc',
          },
        })

        if (oldestPinned) {
          await db.message.update({
            where: { id: oldestPinned.id },
            data: {
              pinned: false,
              pinnedAt: null,
              pinnedBy: null,
            },
          })
        }
      }

      // Pin the new message
      updatedMessage = await db.message.update({
        where: { id: messageId },
        data: {
          pinned: true,
          pinnedAt: new Date(),
          pinnedBy: member.id,
        },
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
                          profile: true,
                        },
                      },
                    },
                  },
                },
                orderBy: {
                  createdAt: 'asc',
                },
              },
              creator: {
                include: {
                  profile: true,
                },
              },
            },
          },
          reactions: {
            include: {
              member: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      })
    }

    // Broadcast the update
    const updateKey = `chat:${channelId}:messages:update`
    try {
      await broadcastMessage(updateKey, updateKey, updatedMessage)
    } catch (error) {
      console.log("[SUPABASE_BROADCAST_ERROR]", error)
    }

    return NextResponse.json(updatedMessage, { status: 200 })
  } catch (error) {
    return secureErrorResponse(error, '[MESSAGE_PIN_PATCH]', 'Failed to pin/unpin message')
  }
}

