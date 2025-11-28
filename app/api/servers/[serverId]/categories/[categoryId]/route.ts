import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { MemberRole } from "@prisma/client"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ serverId: string; categoryId: string }> }
) {
  try {
    const profile = await currentProfile()
    const { name, order } = await req.json()
    const { serverId, categoryId } = await params

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
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

    // Verify category belongs to this server
    const category = await db.channelCategory.findFirst({
      where: {
        id: categoryId,
        serverID: serverId,
      },
    })

    if (!category) {
      return new NextResponse("Category not found", { status: 404 })
    }

    const updateData: { name?: string; order?: number } = {}
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return new NextResponse("Category name cannot be empty", { status: 400 })
      }
      if (name.length > 100) {
        return new NextResponse("Category name too long", { status: 400 })
      }
      updateData.name = name.trim()
    }
    if (order !== undefined) {
      if (typeof order !== "number" || order < 0) {
        return new NextResponse("Invalid order value", { status: 400 })
      }
      updateData.order = order
    }

    const updatedCategory = await db.channelCategory.update({
      where: {
        id: categoryId,
      },
      data: updateData,
      include: {
        channels: {
          orderBy: {
            order: "asc",
          },
        },
      },
    })

    return NextResponse.json(updatedCategory)
  } catch (error) {
    console.error("[CATEGORY_PATCH]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ serverId: string; categoryId: string }> }
) {
  try {
    const profile = await currentProfile()
    const { serverId, categoryId } = await params

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
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

    // Verify category belongs to this server
    const category = await db.channelCategory.findFirst({
      where: {
        id: categoryId,
        serverID: serverId,
      },
      include: {
        channels: true,
      },
    })

    if (!category) {
      return new NextResponse("Category not found", { status: 404 })
    }

    // Move all channels in this category to ungrouped (set categoryId to null)
    if (category.channels.length > 0) {
      await db.channel.updateMany({
        where: {
          categoryId: categoryId,
        },
        data: {
          categoryId: null,
        },
      })
    }

    // Delete the category
    await db.channelCategory.delete({
      where: {
        id: categoryId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[CATEGORY_DELETE]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

