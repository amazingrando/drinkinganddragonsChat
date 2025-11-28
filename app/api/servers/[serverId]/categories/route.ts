import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { MemberRole } from "@prisma/client"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ serverId: string }> }) {
  try {
    const profile = await currentProfile()
    const { serverId } = await params

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Verify user is a member of the server
    const server = await db.server.findFirst({
      where: {
        id: serverId,
        members: {
          some: {
            profileID: profile.id,
          },
        },
      },
    })

    if (!server) {
      return new NextResponse("Server not found or access denied", { status: 403 })
    }

    const categories = await db.channelCategory.findMany({
      where: {
        serverID: serverId,
      },
      include: {
        channels: {
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: {
        order: "asc",
      },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("[CATEGORIES_GET]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ serverId: string }> }) {
  try {
    const profile = await currentProfile()
    const { name } = await req.json()
    const { serverId } = await params

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new NextResponse("Category name is required", { status: 400 })
    }

    if (name.length > 100) {
      return new NextResponse("Category name too long", { status: 400 })
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

    // Get the highest order value to place new category at the end
    const maxOrder = await db.channelCategory.findFirst({
      where: {
        serverID: serverId,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    })

    const newOrder = maxOrder ? maxOrder.order + 1 : 0

    const category = await db.channelCategory.create({
      data: {
        name: name.trim(),
        serverID: serverId,
        order: newOrder,
      },
      include: {
        channels: {
          orderBy: {
            order: "asc",
          },
        },
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error("[CATEGORIES_POST]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

