import { NextRequest, NextResponse } from 'next/server'
import { rateLimitPresets } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.signUpValidation(req)
  if (rateLimitResponse) {
    return rateLimitResponse
  }
  try {
    const { code } = await req.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Sign-up code is required' },
        { status: 400 }
      )
    }

    const signupCodes = process.env.SIGNUP_CODES

    if (!signupCodes) {
      console.error('[SIGNUP_VALIDATE] SIGNUP_CODES environment variable is not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Parse comma-separated codes and trim whitespace
    const validCodes = signupCodes
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)

    const trimmedCode = code.trim()

    if (!validCodes.includes(trimmedCode)) {
      return NextResponse.json(
        { error: 'Invalid sign-up code' },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[SIGNUP_VALIDATE]', error)
    return NextResponse.json(
      { error: 'Bad request' },
      { status: 400 }
    )
  }
}

