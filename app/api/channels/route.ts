import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { MemberRole } from "@prisma/client"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const profile = await currentProfile()
    const { name, type, categoryId } = await req.json()
    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!serverId) {
      return new NextResponse("Server ID is required", { status: 400 })
    }

    if ( name === "general" ) {
      return new NextResponse("Name cannot be 'general'", { status: 400 })
    }

    // If categoryId is provided, verify it belongs to this server
    if (categoryId) {
      const category = await db.channelCategory.findFirst({
        where: {
          id: categoryId,
          serverID: serverId,
        },
      })

      if (!category) {
        return new NextResponse("Category not found", { status: 404 })
      }
    }

    // Get the highest order value for channels in this category (or ungrouped)
    const maxOrderChannel = await db.channel.findFirst({
      where: {
        serverID: serverId,
        categoryId: categoryId || null,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    })

    const newOrder = maxOrderChannel ? maxOrderChannel.order + 1 : 0

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
          create: {
            profileID: profile.id,
            name,
            type,
            categoryId: categoryId || null,
            order: newOrder,
          },
        },
      }
    })

    return NextResponse.json(server)

  } catch (error) {
    console.error("[CHANNELS_POST]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}