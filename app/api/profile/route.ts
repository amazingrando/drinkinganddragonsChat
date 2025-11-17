import { currentProfile } from "@/lib/current-profile"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateUsername } from "@/lib/username-validation"

export async function GET() {
  try {
    const profile = await currentProfile()

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error("[PROFILE_GET]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const profile = await currentProfile()

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { name } = await req.json()

    if (!name || typeof name !== "string") {
      return new NextResponse("Username is required", { status: 400 })
    }

    // Validate username
    const validation = await validateUsername(name.trim(), profile.id)

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, message: validation.message },
        { status: validation.error === "ALREADY_TAKEN" ? 409 : 400 }
      )
    }

    // Update profile
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: { name: name.trim() },
    })

    return NextResponse.json(updatedProfile)
  } catch (error) {
    console.error("[PROFILE_PATCH]", error)
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        { error: "ALREADY_TAKEN", message: "This username is already taken" },
        { status: 409 }
      )
    }

    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

