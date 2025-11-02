import { NextRequest, NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { broadcastMessage } from "@/lib/supabase/server-broadcast"

export async function POST(request: NextRequest) {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get("serverId")
    const channelId = searchParams.get("channelId")
    const body = await request.json()
    const {
      title,
      options,
      allowMultipleChoices,
      allowAddOptions,
      durationHours,
      durationDays,
      endDate,
    }: {
      title: string
      options: string[]
      allowMultipleChoices: boolean
      allowAddOptions: boolean
      durationHours?: number
      durationDays?: number
      endDate?: string
    } = body

    if (!profile) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    if (!serverId) {
      return NextResponse.json({ message: "Server ID is required" }, { status: 400 })
    }
    if (!channelId) {
      return NextResponse.json({ message: "Channel ID is required" }, { status: 400 })
    }
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 })
    }
    if (!options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ message: "At least 2 options are required" }, { status: 400 })
    }
    if (typeof allowMultipleChoices !== "boolean") {
      return NextResponse.json({ message: "allowMultipleChoices must be a boolean" }, { status: 400 })
    }
    if (typeof allowAddOptions !== "boolean") {
      return NextResponse.json({ message: "allowAddOptions must be a boolean" }, { status: 400 })
    }

    const server = await db.server.findFirst({
      where: {
        id: serverId,
        members: { some: { profileID: profile.id } },
      },
      include: { members: true },
    })
    if (!server) {
      return NextResponse.json({ message: "Server not found" }, { status: 404 })
    }

    const channel = await db.channel.findFirst({
      where: { id: channelId, serverID: serverId },
    })
    if (!channel) {
      return NextResponse.json({ message: "Channel not found" }, { status: 404 })
    }

    const member = server.members.find(m => m.profileID === profile.id)
    if (!member) {
      return NextResponse.json({ message: "Member not found" }, { status: 404 })
    }

    // Calculate end date
    let endsAt: Date | undefined = undefined
    if (endDate) {
      endsAt = new Date(endDate)
      if (isNaN(endsAt.getTime())) {
        return NextResponse.json({ message: "Invalid end date format" }, { status: 400 })
      }
    } else if (durationHours) {
      endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)
    } else if (durationDays) {
      endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
    }

    // Create message for the poll
    const message = await db.message.create({
      data: {
        content: `Poll: ${title}`,
        channelId: channel.id,
        memberId: member.id,
      },
    })

    // Create poll with options
    const poll = await db.poll.create({
      data: {
        title,
        allowMultipleChoices,
        allowAddOptions,
        endsAt,
        messageId: message.id,
        creatorId: member.id,
        options: {
          create: options.map((text) => ({ 
            text: text.trim(),
            createdBy: member.id,
          })),
        },
      },
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

    // Fetch complete message with poll
    const messageWithPoll = await db.message.findUnique({
      where: { id: message.id },
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

    // Broadcast the new message with poll
    const channelKey = `chat:${channelId}:messages`
    try {
      if (messageWithPoll) {
        await broadcastMessage(channelKey, channelKey, messageWithPoll)
      }
    } catch (error) {
      console.log("[SUPABASE_BROADCAST_ERROR]", error)
    }

    return NextResponse.json(poll, { status: 200 })
  } catch (error) {
    console.error("[POLLS_POST]", error)
    return NextResponse.json(
      { 
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const pollId = searchParams.get("pollId")

    if (!profile) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!pollId) {
      return NextResponse.json({ message: "Poll ID is required" }, { status: 400 })
    }

    const poll = await db.poll.findUnique({
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

    if (!poll) {
      return NextResponse.json({ message: "Poll not found" }, { status: 404 })
    }

    return NextResponse.json(poll, { status: 200 })
  } catch (error) {
    console.log("[POLLS_GET]", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

