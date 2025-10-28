import { NextRequest, NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { broadcastMessage } from "@/lib/supabase/server-broadcast"

export async function POST(request: NextRequest) {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get("serverId")
    const channelId = searchParams.get("channelId")
    const { content, fileUrl }: { content?: string; fileUrl?: string } = await request.json()

    if (!profile) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    if (!serverId) {
      return NextResponse.json({ message: "Server ID is required" }, { status: 400 })
    }
    if (!channelId) {
      return NextResponse.json({ message: "Channel ID is required" }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ message: "Content is required" }, { status: 400 })
    }

    const server = await db.server.findFirst({
      where: {
        id: serverId,
        members: { some: { profileID: profile.id } },
      },
      include: { members: true },
    })
    if (!server) {
      return NextResponse.json({ message: "Server not found" }, { status: 404 })
    }

    const channel = await db.channel.findFirst({
      where: { id: channelId, serverID: serverId },
    })
    if (!channel) {
      return NextResponse.json({ message: "Channel not found" }, { status: 404 })
    }

    const member = server.members.find(m => m.profileID === profile.id)
    if (!member) {
      return NextResponse.json({ message: "Member not found" }, { status: 404 })
    }

    const message = await db.message.create({
      data: {
        content,
        fileUrl,
        channelId: channel.id,
        memberId: member.id,
      },
      include: {
        member: { include: { profile: true } },
      },
    })

    const channelKey = `chat:${channelId}:messages`
    try {
      await broadcastMessage(channelKey, channelKey, message)
    } catch (error) {
      console.log("[SUPABASE_BROADCAST_ERROR]", error)
    }

    return NextResponse.json(message, { status: 200 })
  } catch (error) {
    console.log("[MESSAGES_POST]", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}


