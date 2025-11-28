import { currentProfile } from "@/lib/current-profile"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { MemberRole } from "@prisma/client"

export async function DELETE(req: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!serverId) {
      return new NextResponse("Server ID is required", { status: 400 })
    }

    if (!(await params).channelId) {
      return new NextResponse("Channel ID is required", { status: 400 })
    }

    const server = await db.server.update({
      where: {
        id: serverId,
        members: {
          some: {
            profileID: profile.id,
            role: {
              in: [MemberRole.ADMIN, MemberRole.MODERATOR],
            }
          }
        }
      },
      data: {
        channels: {
          delete: {
            id: (await params).channelId,
            name: {
              not: "general",
            }
          },
        },
      },
    })

    return NextResponse.json(server)

  } catch (error) {
    console.error("[CHANNEL_ID_DELETE]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const profile = await currentProfile()
    const { name, type, description } = await req.json()
    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!serverId) {
      return new NextResponse("Server ID is required", { status: 400 })
    }

    if (!(await params).channelId) {
      return new NextResponse("Channel ID is required", { status: 400 })
    }

    if (name === "general") {
      return new NextResponse("Name cannot be 'general'", { status: 400 })
    }

    const updateData: { name?: string; type?: string; description?: string | null } = {}
    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type
    if (description !== undefined) updateData.description = description || null

    const server = await db.server.update({
      where: {
        id: serverId,
        members: {
          some: {
            profileID: profile.id,
            role: {
              in: [MemberRole.ADMIN, MemberRole.MODERATOR],
            }
          }
        }
      },
      data: {
        channels: {
          update: {
            where: {
              id: (await params).channelId,
              NOT: {
                name: "general",
              }
            },
            data: updateData,
          },
        },
      },
    })

    return NextResponse.json(server)

  } catch (error) {
    console.error("[CHANNEL_ID_PATCH]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}