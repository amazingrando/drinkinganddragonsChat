import { NextResponse } from "next/server"

import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(req.url)
    const { memberId } = await params

    const serverId = searchParams.get("serverId")

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!serverId) {
      return new NextResponse("Server ID is required", { status: 400 })
    }

    if (!memberId) {
      return new NextResponse("Member ID is required", { status: 400 })
    }

    const server = await db.server.update({
      where: {
        id: serverId,
        profileID: profile.id,
      },
      data: {
        members: {
          deleteMany: {
            id: memberId,
            profileID: {
              not: profile.id,
            },
          },
        },
      },
      include: {
        members: {
          include: {
            profile: true,
          },
          orderBy: {
            role: 'asc',
          },
        },
      },
    })
    
    return NextResponse.json(server)
    
  } catch (error) {
    console.error("[MEMBER_ID_DELETE]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(req.url)
    const { role } = await req.json()
    const { memberId } = await params

    const serverId = searchParams.get("serverId")

    
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!serverId) {
      return new NextResponse("Server ID is required", { status: 400 })
    }

    if (!memberId) {
      return new NextResponse("Member ID is required", { status: 400 })
    }

    const server = await db.server.update({
      where: {
        id: serverId,
        profileID: profile.id,
      },
      data: {
        members: {
          update: {
            where: {
              id: memberId,
              profileID: {
                not: profile.id,
              }
            },
            data: {
              role,
            },
          }
        }
      },
      include: {
        members: {
          include: {
            profile: true,
          },
          orderBy: {
            role: 'asc',
          },
        }
      },
    })

    return NextResponse.json(server)
    
  } catch (error) {
    console.error("[MEMBER_ID_PATCH]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}