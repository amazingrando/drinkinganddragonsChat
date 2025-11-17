import { currentProfile } from "@/lib/current-profile"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateUsername } from "@/lib/username-validation"
import { createClient } from "@/lib/supabase/server"

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

// Helper function to extract filename from Supabase storage URL
function extractFilenameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  
  // Match pattern: .../storage/v1/object/public/avatars/filename
  const match = url.match(/\/avatars\/([^/?]+)/)
  return match ? match[1] : null
}

export async function PATCH(req: Request) {
  try {
    const profile = await currentProfile()

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { name, imageUrl } = await req.json()

    // Build update data object
    const updateData: { name?: string; imageUrl?: string | null } = {}

    // Handle name update if provided
    if (name !== undefined) {
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

      updateData.name = name.trim()
    }

    // Handle imageUrl update if provided
    if (imageUrl !== undefined) {
      // If setting to null/empty, delete old avatar from storage
      if (!imageUrl || imageUrl.trim() === "") {
        const oldImageUrl = profile.imageUrl
        if (oldImageUrl) {
          const filename = extractFilenameFromUrl(oldImageUrl)
          if (filename) {
            const supabase = await createClient()
            // Delete old avatar from storage (ignore errors if file doesn't exist)
            await supabase.storage.from("avatars").remove([filename]).catch(() => {
              // File might not exist, that's okay
            })
          }
        }
        updateData.imageUrl = ""
      } else {
        // If setting a new imageUrl, delete old one if it exists
        const oldImageUrl = profile.imageUrl
        if (oldImageUrl && oldImageUrl !== imageUrl) {
          const filename = extractFilenameFromUrl(oldImageUrl)
          if (filename) {
            const supabase = await createClient()
            // Delete old avatar from storage (ignore errors if file doesn't exist)
            await supabase.storage.from("avatars").remove([filename]).catch(() => {
              // File might not exist, that's okay
            })
          }
        }
        updateData.imageUrl = imageUrl
      }
    }

    // Update profile
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: updateData,
    })

    // Revalidate any cached profile data
    return NextResponse.json(updatedProfile, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    })
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

