import { NextRequest, NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { MemberRole } from "@prisma/client"
import { broadcastMessage } from "@/lib/supabase/server-broadcast"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ directMessageId: string }> }) {
  const { directMessageId } = await params
  return handleModify(request, { directMessageId }, "DELETE")
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ directMessageId: string }> }) {
  const { directMessageId } = await params
  return handleModify(request, { directMessageId }, "PATCH")
}

async function handleModify(
  request: NextRequest,
  { directMessageId }: { directMessageId: string },
  method: "DELETE" | "PATCH",
) {
  try {
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversationId")
    const content: string | undefined = method === "PATCH"
      ? ((await request.json()) as { content?: string }).content
      : undefined

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
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
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const member = conversation.memberOne.profileID === profile.id ? conversation.memberOne : conversation.memberTwo

    let directMessage = await db.directMessage.findFirst({
      where: { id: directMessageId, conversationId: conversationId },
      include: { member: { include: { profile: true } } },
    })
    if (!directMessage || directMessage.deleted) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const isMessageOwner = directMessage.memberId === member.id
    const isAdmin = member.role === MemberRole.ADMIN
    const isModerator = member.role === MemberRole.MODERATOR
    const canModify = isMessageOwner || isAdmin || isModerator
    if (!canModify) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (method === "DELETE") {
      directMessage = await db.directMessage.update({
        where: { id: directMessageId },
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
      directMessage = await db.directMessage.update({
        where: { id: directMessageId },
        data: { content },
        include: { member: { include: { profile: true } } },
      })
    }

    const updateKey = `chat:${conversation.id}:directMessages:update`
    try {
      await broadcastMessage(updateKey, updateKey, directMessage)
    } catch (error) {
      console.log("[SUPABASE_BROADCAST_ERROR]", error)
    }

    return NextResponse.json(directMessage, { status: 200 })
  } catch (error) {
    console.error("[MESSAGE_ID_REQUEST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


