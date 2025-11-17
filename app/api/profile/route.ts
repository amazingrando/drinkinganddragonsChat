import { currentProfile } from "@/lib/current-profile"
import { NextResponse } from "next/server"

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

