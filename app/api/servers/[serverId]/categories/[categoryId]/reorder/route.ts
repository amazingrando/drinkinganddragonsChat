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
    const { order } = await req.json()
    const { serverId, categoryId } = await params

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (order === undefined || typeof order !== "number" || order < 0) {
      return new NextResponse("Valid order value is required", { status: 400 })
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

    const updatedCategory = await db.channelCategory.update({
      where: {
        id: categoryId,
      },
      data: {
        order,
      },
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
    console.error("[CATEGORY_REORDER_PATCH]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

