import { currentProfile } from "@/lib/current-profile"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"
import { MemberRole } from "@prisma/client"

export async function GET() {
  try {
    const profile = await currentProfile()

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const serverCount = await db.server.count({
      where: {
        members: {
          some: {
            profileID: profile.id,
          },
        },
      },
    })

    return NextResponse.json({ hasServers: serverCount > 0 })
  } catch (error) {
    console.error("[SERVERS_GET]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { name, imageUrl } = await req.json()
    const profile = await currentProfile()

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const server = await db.server.create({
      data: { name, imageUrl, profileID: profile.id, inviteCode: uuidv4(),
        channels: {
          create: {
            name: "general",
            profileID: profile.id
          }
        },
        members: {
          create: {
            profileID: profile.id,
            role: MemberRole.ADMIN
          }
        }
      }
    })

    return NextResponse.json(server)
  } catch (error) {
    console.error("[SERVERS_POST]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}