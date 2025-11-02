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
    const { optionId, removeVote }: { optionId: string; removeVote?: boolean } = await request.json()

    if (!profile) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const poll = await db.poll.findUnique({
      where: { id: pollId },
      include: {
        options: true,
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

    // Find the member through server membership
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

    // Handle vote
    if (removeVote) {
      await db.pollVote.deleteMany({
        where: {
          pollId: pollId,
          optionId: optionId,
          memberId: member.id,
        },
      })
    } else {
      // Check if multiple choices are allowed
      if (!poll.allowMultipleChoices) {
        // Remove all existing votes for this member on this poll
        await db.pollVote.deleteMany({
          where: {
            pollId: pollId,
            memberId: member.id,
          },
        })
      }

      // Check if vote already exists
      const existingVote = await db.pollVote.findFirst({
        where: {
          pollId: pollId,
          optionId: optionId,
          memberId: member.id,
        },
      })

      if (!existingVote) {
        await db.pollVote.create({
          data: {
            pollId: pollId,
            optionId: optionId,
            memberId: member.id,
          },
        })
      }
    }

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
      const channelKey = `poll:${pollId}:votes`
      try {
        await broadcastMessage(channelKey, channelKey, updatedPoll)
      } catch (error) {
        console.log("[SUPABASE_BROADCAST_ERROR]", error)
      }

      // Also broadcast to message channel to update the display
      const messageUpdateKey = `chat:${channelId}:messages:update`
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
          await broadcastMessage(messageUpdateKey, messageUpdateKey, messageWithPoll)
        }
      } catch (error) {
        console.log("[SUPABASE_BROADCAST_ERROR]", error)
      }
    }

    return NextResponse.json(updatedPoll, { status: 200 })
  } catch (error) {
    console.log("[POLL_VOTE_POST]", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

