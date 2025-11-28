import { currentProfile } from "@/lib/current-profile"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rateLimitPresets } from "@/lib/rate-limit"
import { ChannelType } from "@prisma/client"
import { uuidSchema } from "@/lib/validation"

/**
 * Sanitizes error information for logging to prevent information leakage
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Only log error message, not stack trace or full error object
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  return "Unknown error occurred"
}

/**
 * Validates the type parameter against allowed values
 */
function validateType(type: string | null): "user" | "channel" | null {
  if (type === "user" || type === "channel") {
    return type
  }
  return null
}

/**
 * GET /api/mentions
 * Searches for users and channels to mention in a server
 * 
 * Query parameters:
 * - serverId: UUID of the server (required)
 * - query: Search query string (optional, max 100 chars)
 * - type: Filter by "user" or "channel" (optional)
 * 
 * Security:
 * - Requires authentication
 * - Validates serverId is a valid UUID
 * - Verifies user is a member of the server
 * - Limits query length to prevent DoS
 * - Validates type parameter
 * 
 * Performance:
 * - Uses Promise.all to fetch users and channels in parallel
 * - Rate limited to prevent abuse
 * - Note: Caching could be added for frequently searched queries,
 *   but results change frequently (users joining/leaving, channels created),
 *   so a short TTL (5-10 seconds) would be appropriate if implemented
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimitPresets.lenient(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const profile = await currentProfile()
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get("serverId")
    const query = searchParams.get("query") || ""
    const rawType = searchParams.get("type")
    const type = validateType(rawType)

    if (!serverId) {
      return NextResponse.json({ error: "Server ID is required" }, { status: 400 })
    }

    // Validate serverId is a valid UUID
    const serverIdValidation = uuidSchema.safeParse(serverId)
    if (!serverIdValidation.success) {
      return NextResponse.json({ error: "Invalid server ID format" }, { status: 400 })
    }

    // Validate query length to prevent DoS
    const MAX_QUERY_LENGTH = 100
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ error: "Query too long" }, { status: 400 })
    }

    // Verify user is a member of the server
    const member = await db.member.findFirst({
      where: {
        serverID: serverId,
        profileID: profile.id,
      },
    })

    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const results: Array<{
      id: string
      name: string
      type: "user" | "channel"
      imageUrl?: string
    }> = []

    // Optimize: Fetch users and channels in parallel
    const [membersResult, channelsResult] = await Promise.all([
      // Fetch users if type is "user" or not specified
      (!type || type === "user")
        ? db.member.findMany({
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
        : Promise.resolve([]),
      // Fetch channels if type is "channel" or not specified
      (!type || type === "channel")
        ? db.channel.findMany({
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
        : Promise.resolve([]),
    ])

    // Process user results
    for (const m of membersResult) {
      if (m.profileID !== profile.id) {
        results.push({
          id: m.id,
          name: m.profile.name,
          type: "user",
          imageUrl: m.profile.imageUrl,
        })
      }
    }

    // Process channel results
    for (const channel of channelsResult) {
      results.push({
        id: channel.id,
        name: channel.name,
        type: "channel",
      })
    }

    return NextResponse.json(results)
  } catch (error) {
    // Sanitize error before logging to prevent information leakage
    const sanitizedError = sanitizeError(error)
    console.error("[MENTIONS_API_ERROR]", sanitizedError)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

