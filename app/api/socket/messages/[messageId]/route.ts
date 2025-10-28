import { NextRequest, NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { MemberRole } from "@prisma/client"
import { broadcastMessage } from "@/lib/supabase/server-broadcast"

export async function DELETE(request: NextRequest, { params }: { params: { messageId: string } }) {
  return handleModify(request, params, "DELETE")
}

export async function PATCH(request: NextRequest, { params }: { params: { messageId: string } }) {
  return handleModify(request, params, "PATCH")
}

async function handleModify(request: NextRequest, { messageId }: { messageId: string }, method: "DELETE" | "PATCH") {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get("serverId")
    const channelId = searchParams.get("channelId")
    const body = method === "PATCH" ? await request.json() : {}
    const content: string | undefined = (body as any).content

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!serverId) {
      return NextResponse.json({ error: "Server ID is required" }, { status: 400 })
    }
    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 })
    }

    const server = await db.server.findFirst({
      where: {
        id: serverId,
        members: { some: { profileID: profile.id } },
      },
      include: { members: true },
    })
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 })
    }

    const channel = await db.channel.findFirst({
      where: { id: channelId, serverID: serverId },
    })
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 })
    }

    const member = server.members.find(m => m.profileID === profile.id)
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    let message = await db.message.findFirst({
      where: { id: messageId, channelId: channelId },
      include: { member: { include: { profile: true } } },
    })
    if (!message || message.deleted) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const isMessageOwner = message.memberId === member.id
    const isAdmin = member.role === MemberRole.ADMIN
    const isModerator = member.role === MemberRole.MODERATOR
    const canModify = isMessageOwner || isAdmin || isModerator
    if (!canModify) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (method === "DELETE") {
      message = await db.message.update({
        where: { id: messageId },
        data: {
          fileUrl: null,
          content: "This message has been deleted",
          deleted: true,
        },
        include: { member: { include: { profile: true } } },
      })
    } else {
      if (!isMessageOwner) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      message = await db.message.update({
        where: { id: messageId },
        data: { content },
        include: { member: { include: { profile: true } } },
      })
    }

    const updateKey = `chat:${channelId}:messages:update`
    try {
      await broadcastMessage(updateKey, updateKey, message)
    } catch (error) {
      console.log("[SUPABASE_BROADCAST_ERROR]", error)
    }

    return NextResponse.json(message, { status: 200 })
  } catch (error) {
    console.error("[MESSAGE_ID_REQUEST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


