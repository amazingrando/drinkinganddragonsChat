import { NextRequest, NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { broadcastMessage } from "@/lib/supabase/server-broadcast"

export async function POST(request: NextRequest) {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversationId")
    const { content, fileUrl, optimisticId } = (await request.json()) as { content?: string; fileUrl?: string; optimisticId?: string }

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID missing" }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: "Content missing" }, { status: 400 })
    }

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { memberOne: { profileID: profile.id } },
          { memberTwo: { profileID: profile.id } },
        ],
      },
      include: {
        memberOne: { include: { profile: true } },
        memberTwo: { include: { profile: true } },
      },
    })
    if (!conversation) {
      return NextResponse.json({ message: "Conversation not found" }, { status: 404 })
    }

    const member = conversation.memberOne.profileID === profile.id ? conversation.memberOne : conversation.memberTwo
    if (!member) {
      return NextResponse.json({ message: "Member not found" }, { status: 404 })
    }

    const message = await db.directMessage.create({
      data: {
        content,
        fileUrl,
        conversationId: conversationId,
        memberId: member.id,
      },
      include: {
        member: { include: { profile: true } },
      },
    })

    const channelKey = `chat:${conversationId}:messages`
    const payload = {
      ...message,
      optimisticId,
    }
    try {
      await broadcastMessage(channelKey, channelKey, payload)
    } catch (error) {
      console.log("[SUPABASE_BROADCAST_ERROR]", error)
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    console.log("[DIRECT_MESSAGES_POST]", error)
    return NextResponse.json({ message: "Internal Error" }, { status: 500 })
  }
}


