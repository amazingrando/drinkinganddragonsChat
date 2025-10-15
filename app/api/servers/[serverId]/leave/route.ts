import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ serverId: string }> }) {
  try {
    const profile = await currentProfile()

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!(await params).serverId) {
      return new NextResponse("Server ID is required", { status: 400 })
    }

    const server = await db.server.update({
      where: {
        id: (await params).serverId,
        profileID: {
          not: profile.id,
        },
        members: {
          some: {
            profileID: profile.id,
          },
        },
      },
      data: {
        members: {
          deleteMany: {
            profileID: profile.id,
          },
        },
      },
    })

    return NextResponse.json(server)

  } catch (error) {
    console.error("[SERVER_ID_LEAVE]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
