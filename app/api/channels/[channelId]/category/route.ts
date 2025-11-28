import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { MemberRole } from "@prisma/client"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const profile = await currentProfile()
    const { categoryId, order } = await req.json()
    const { channelId } = await params
    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!serverId) {
      return new NextResponse("Server ID is required", { status: 400 })
    }

    // Verify user is Admin or Moderator
    const server = await db.server.findFirst({
      where: {
        id: serverId,
        members: {
          some: {
            profileID: profile.id,
            role: {
              in: [MemberRole.ADMIN, MemberRole.MODERATOR],
            },
          },
        },
      },
    })

    if (!server) {
      return new NextResponse("Server not found or access denied", { status: 403 })
    }

    // Verify channel belongs to this server
    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        serverID: serverId,
      },
    })

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 })
    }

    // If categoryId is provided, verify it belongs to this server
    if (categoryId !== null && categoryId !== undefined) {
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

    const updateData: { categoryId?: string | null; order?: number } = {}
    if (categoryId !== undefined) {
      updateData.categoryId = categoryId || null
    }
    if (order !== undefined) {
      if (typeof order !== "number" || order < 0) {
        return new NextResponse("Invalid order value", { status: 400 })
      }
      updateData.order = order
    }

    const updatedChannel = await db.channel.update({
      where: {
        id: channelId,
      },
      data: updateData,
    })

    return NextResponse.json(updatedChannel)
  } catch (error) {
    console.error("[CHANNEL_CATEGORY_PATCH]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

