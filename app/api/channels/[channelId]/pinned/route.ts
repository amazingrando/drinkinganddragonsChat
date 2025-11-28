import { currentProfile } from "@/lib/current-profile"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rateLimitPresets } from "@/lib/rate-limit"
import { secureErrorResponse } from "@/lib/error-handling"

export async function GET(request: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.lenient(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get('serverId')
    const { channelId } = await params

    if (!profile) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (!serverId) {
      return new NextResponse('Server ID is required', { status: 400 })
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
    if (serverId !== channel.serverID) {
      return new NextResponse('Server ID mismatch', { status: 400 })
    }

    // Fetch all pinned messages for this channel
    const pinnedMessages = await db.message.findMany({
      where: {
        channelId: channelId,
        pinned: true,
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
        pinnedAt: 'desc', // Most recently pinned first
      },
    })

    return NextResponse.json({
      items: pinnedMessages,
    })
    
  } catch (error) {
    return secureErrorResponse(error, '[PINNED_MESSAGES_GET]', 'Failed to retrieve pinned messages')
  }
}

