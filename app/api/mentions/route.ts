import { currentProfile } from "@/lib/current-profile"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rateLimitPresets } from "@/lib/rate-limit"
import { ChannelType } from "@prisma/client"
import { uuidSchema } from "@/lib/validation"

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimitPresets.lenient(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const profile = await currentProfile()
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get("serverId")
    const query = searchParams.get("query") || ""
    const type = searchParams.get("type") as "user" | "channel" | null

    if (!serverId) {
      return new NextResponse("Server ID is required", { status: 400 })
    }

    // Validate serverId is a valid UUID
    const serverIdValidation = uuidSchema.safeParse(serverId)
    if (!serverIdValidation.success) {
      return new NextResponse("Invalid server ID format", { status: 400 })
    }

    // Validate query length to prevent DoS
    const MAX_QUERY_LENGTH = 100
    if (query.length > MAX_QUERY_LENGTH) {
      return new NextResponse("Query too long", { status: 400 })
    }

    // Verify user is a member of the server
    const member = await db.member.findFirst({
      where: {
        serverID: serverId,
        profileID: profile.id,
      },
    })

    if (!member) {
      return new NextResponse("Access denied", { status: 403 })
    }

    const results: Array<{
      id: string
      name: string
      type: "user" | "channel"
      imageUrl?: string
    }> = []

    // Fetch users if type is "user" or not specified
    if (!type || type === "user") {
      const members = await db.member.findMany({
        where: {
          serverID: serverId,
          profile: {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        include: {
          profile: true,
        },
        take: 10,
      })

      for (const m of members) {
        if (m.profileID !== profile.id) {
          results.push({
            id: m.id,
            name: m.profile.name,
            type: "user",
            imageUrl: m.profile.imageUrl,
          })
        }
      }
    }

    // Fetch channels if type is "channel" or not specified
    if (!type || type === "channel") {
      const channels = await db.channel.findMany({
        where: {
          serverID: serverId,
          type: ChannelType.TEXT,
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        take: 10,
      })

      for (const channel of channels) {
        results.push({
          id: channel.id,
          name: channel.name,
          type: "channel",
        })
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("[MENTIONS_API_ERROR]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

