import { NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"

export async function PATCH(req: Request, { params }: { params: Promise<{ serverId: string }> }) {
  try {
    const profile = await currentProfile()

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { serverId } = await params

    if (!serverId) {
      return new NextResponse("Server ID is required", { status: 400 })
    }

    const server = await db.server.update({
      where: {
        id: serverId,
        profileID: profile.id,
      },
      data: {
        inviteCode: uuidv4(),
      },
    })

    return NextResponse.json(server)

  } catch (error) {
    console.error("[SERVER_ID_PATCH]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}