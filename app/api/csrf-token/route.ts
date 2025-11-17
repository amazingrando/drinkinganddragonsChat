import { NextRequest, NextResponse } from 'next/server'
import { generateCsrfToken } from '@/lib/csrf'

/**
 * Endpoint to generate and retrieve a CSRF token
 * This should be called from the client side before making state-changing requests
 */
export async function GET(req: NextRequest) {
  try {
    const token = await generateCsrfToken()
    
    return NextResponse.json(
      { token },
      {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    )
  } catch (error) {
    console.error('[CSRF_TOKEN] Error generating token:', error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}

