import { currentProfile } from "@/lib/current-profile"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { Message } from "@prisma/client"

const MESSAGES_BATCH = 10

export async function GET(request: NextRequest) {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    
    const cursor = searchParams.get('cursor')
    const channelId = searchParams.get('channelId')

    if (!profile) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (!channelId) {
      return new NextResponse('Channel ID is required', { status: 400 })
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
              },
              creator: {
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
              },
              creator: {
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
    console.error('[MESSAGES_GET]', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}