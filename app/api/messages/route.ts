import { currentProfile } from "@/lib/current-profile"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { Message } from "@prisma/client"
import { rateLimitPresets } from "@/lib/rate-limit"
import { secureErrorResponse } from "@/lib/error-handling"

const MESSAGES_BATCH = 30

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.lenient(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    
    const cursor = searchParams.get('cursor')
    const channelId = searchParams.get('channelId')
    const serverId = searchParams.get('serverId')

    if (!profile) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (!channelId) {
      return new NextResponse('Channel ID is required', { status: 400 })
    }

    // Fetch channel first to get the serverId (more secure than trusting client-provided serverId)
    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
      },
      include: {
        server: {
          include: {
            members: {
              where: { profileID: profile.id },
            },
          },
        },
      },
    })

    if (!channel) {
      return new NextResponse('Channel not found or access denied', { status: 403 })
    }

    // Verify user is a member of the server that owns this channel
    if (!channel.server || channel.server.members.length === 0) {
      return new NextResponse('Server not found or access denied', { status: 403 })
    }

    // If serverId was provided, verify it matches the channel's server (optional but adds extra validation)
    if (serverId && serverId !== channel.serverID) {
      return new NextResponse('Server ID mismatch', { status: 400 })
    }

    let messages: Message[] = []
    
    if (cursor) {
      messages = await db.message.findMany({
        take: MESSAGES_BATCH,
        skip: 1,
        cursor: {
          id: cursor,
        },
        where: {
          channelId: channelId,
        },
        include: {
          member: {
            include: {
              profile: true,
            },
          },
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
        orderBy: {
          createdAt: 'desc',
        },
      })
    } else {
      messages = await db.message.findMany({
        take: MESSAGES_BATCH,
        where: {
          channelId: channelId,
        },
        include: {
          member: {
            include: {
              profile: true,
            },
          },
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
        orderBy: {
          createdAt: 'desc',
        },
      })
    }

    let nextCursor = null

    if (messages.length === MESSAGES_BATCH) {
      nextCursor = messages[MESSAGES_BATCH - 1].id
    }

    return NextResponse.json({
      items: messages,
      nextCursor,
    })
    
  } catch (error) {
    return secureErrorResponse(error, '[MESSAGES_GET]', 'Failed to retrieve messages')
  }
}