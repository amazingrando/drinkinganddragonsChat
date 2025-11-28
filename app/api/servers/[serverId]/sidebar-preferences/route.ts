import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { secureErrorResponse } from "@/lib/error-handling"
import { rateLimitPresets } from "@/lib/rate-limit"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.lenient(req)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const profile = await currentProfile()
    const { serverId } = await params

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Verify user is a member of the server
    const server = await db.server.findFirst({
      where: {
        id: serverId,
        members: {
          some: {
            profileID: profile.id,
          },
        },
      },
    })

    if (!server) {
      return new NextResponse("Server not found or access denied", { status: 403 })
    }

    // Get the member for this server
    const member = await db.member.findFirst({
      where: {
        profileID: profile.id,
        serverID: serverId,
      },
    })

    if (!member) {
      return new NextResponse("Member not found", { status: 404 })
    }

    // Get or create sidebar preferences
    let preferences = await db.serverSidebarPreferences.findUnique({
      where: {
        memberId_serverId: {
          memberId: member.id,
          serverId: serverId,
        },
      },
    })

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await db.serverSidebarPreferences.create({
        data: {
          memberId: member.id,
          serverId: serverId,
          collapsedCategories: [],
          collapsedMembers: false,
        },
      })
    }

    return NextResponse.json({
      collapsedCategories: Array.isArray(preferences.collapsedCategories)
        ? preferences.collapsedCategories
        : [],
      collapsedMembers: preferences.collapsedMembers,
    })
  } catch (error) {
    return secureErrorResponse(error, "[SIDEBAR_PREFERENCES_GET]", "Failed to retrieve sidebar preferences")
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.moderate(req)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const profile = await currentProfile()
    const { serverId } = await params
    const body = await req.json()

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Validate request body
    const { collapsedCategories, collapsedMembers } = body

    if (
      collapsedCategories !== undefined &&
      (!Array.isArray(collapsedCategories) ||
        !collapsedCategories.every((id: unknown) => typeof id === "string"))
    ) {
      return new NextResponse("Invalid collapsedCategories format", { status: 400 })
    }

    if (collapsedMembers !== undefined && typeof collapsedMembers !== "boolean") {
      return new NextResponse("Invalid collapsedMembers format", { status: 400 })
    }

    // Verify user is a member of the server
    const server = await db.server.findFirst({
      where: {
        id: serverId,
        members: {
          some: {
            profileID: profile.id,
          },
        },
      },
    })

    if (!server) {
      return new NextResponse("Server not found or access denied", { status: 403 })
    }

    // Get the member for this server
    const member = await db.member.findFirst({
      where: {
        profileID: profile.id,
        serverID: serverId,
      },
    })

    if (!member) {
      return new NextResponse("Member not found", { status: 404 })
    }

    // Update or create preferences
    const preferences = await db.serverSidebarPreferences.upsert({
      where: {
        memberId_serverId: {
          memberId: member.id,
          serverId: serverId,
        },
      },
      update: {
        ...(collapsedCategories !== undefined && { collapsedCategories }),
        ...(collapsedMembers !== undefined && { collapsedMembers }),
      },
      create: {
        memberId: member.id,
        serverId: serverId,
        collapsedCategories: collapsedCategories ?? [],
        collapsedMembers: collapsedMembers ?? false,
      },
    })

    return NextResponse.json({
      collapsedCategories: Array.isArray(preferences.collapsedCategories)
        ? preferences.collapsedCategories
        : [],
      collapsedMembers: preferences.collapsedMembers,
    })
  } catch (error) {
    return secureErrorResponse(error, "[SIDEBAR_PREFERENCES_PATCH]", "Failed to update sidebar preferences")
  }
}

