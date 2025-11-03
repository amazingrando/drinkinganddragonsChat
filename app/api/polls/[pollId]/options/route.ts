import { NextRequest, NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { broadcastMessage } from "@/lib/supabase/server-broadcast"

export async function POST(request: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  try {
    const { pollId } = await params
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get("channelId")
    const { text }: { text: string } = await request.json()

    if (!profile) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ message: "Option text is required" }, { status: 400 })
    }

    const poll = await db.poll.findUnique({
      where: { id: pollId },
      include: {
        creator: {
          include: {
            profile: true,
          },
        },
      },
    })

    if (!poll) {
      return NextResponse.json({ message: "Poll not found" }, { status: 404 })
    }

    // Check if poll is closed
    const isClosed = poll.closedAt !== null || (poll.endsAt && new Date(poll.endsAt) < new Date())
    if (isClosed) {
      return NextResponse.json({ message: "Poll is closed" }, { status: 400 })
    }

    // Check if adding options is allowed
    if (!poll.allowAddOptions) {
      return NextResponse.json({ message: "Adding options is not allowed for this poll" }, { status: 403 })
    }

    // Find the member
    const server = await db.server.findFirst({
      where: {
        members: { some: { profileID: profile.id } },
      },
      include: { members: true },
    })

    const member = server?.members.find(m => m.profileID === profile.id)
    if (!member) {
      return NextResponse.json({ message: "Member not found" }, { status: 404 })
    }

    // Create the option
    await db.pollOption.create({
      data: {
        text: text.trim(),
        pollId: pollId,
        createdBy: member.id,
      },
    })

    // Fetch updated poll
    const updatedPoll = await db.poll.findUnique({
      where: { id: pollId },
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
    })

    // Broadcast the updated poll
    if (channelId && updatedPoll) {
      const channelKey = `poll:${pollId}:options`
      try {
        await broadcastMessage(channelKey, channelKey, updatedPoll)
      } catch (error) {
        console.log("[SUPABASE_BROADCAST_ERROR]", error)
      }

      // Also broadcast to message channel to update the display
      const messageChannelKey = `chat:${channelId}:messages`
      try {
        const messageWithPoll = await db.message.findUnique({
          where: { id: poll.messageId },
          include: {
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
            member: {
              include: {
                profile: true,
              },
            },
          },
        })
        if (messageWithPoll) {
          await broadcastMessage(messageChannelKey, messageChannelKey, messageWithPoll)
        }
      } catch (error) {
        console.log("[SUPABASE_BROADCAST_ERROR]", error)
      }
    }

    return NextResponse.json(updatedPoll, { status: 200 })
  } catch (error) {
    console.log("[POLL_OPTIONS_POST]", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

