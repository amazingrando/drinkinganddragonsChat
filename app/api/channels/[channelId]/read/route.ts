import { NextRequest, NextResponse } from "next/server"

import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"

type ChannelReadBody = {
  lastMessageId?: string | null
  lastReadAt?: string | null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const profile = await currentProfile()
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { channelId } = await params
    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) {
      return NextResponse.json({ error: "Server ID is required" }, { status: 400 })
    }

    const member = await db.member.findFirst({
      where: {
        serverID: serverId,
        profileID: profile.id,
      },
    })

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        serverID: serverId,
      },
    })

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 })
    }

    const body = (await request.json()) as ChannelReadBody | null
    const timestamp = body?.lastReadAt ? new Date(body.lastReadAt) : new Date()

    const existing = await db.channelReadState.findUnique({
      where: {
        memberId_channelId: {
          memberId: member.id,
          channelId,
        },
      },
    })

    if (existing && timestamp <= existing.lastReadAt) {
      return NextResponse.json(existing, { status: 200 })
    }

    const readState = await db.channelReadState.upsert({
      where: {
        memberId_channelId: {
          memberId: member.id,
          channelId,
        },
      },
      create: {
        memberId: member.id,
        channelId,
        lastMessageId: body?.lastMessageId ?? null,
        lastReadAt: timestamp,
      },
      update: {
        lastMessageId: body?.lastMessageId ?? null,
        lastReadAt: timestamp,
      },
    })

    return NextResponse.json(readState, { status: 200 })
  } catch (error) {
    console.error("[CHANNEL_READ_POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

