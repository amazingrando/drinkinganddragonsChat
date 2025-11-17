import { NextRequest, NextResponse } from 'next/server'

/**
 * CSP Report Endpoint
 * 
 * Receives CSP violation reports from browsers when using Content-Security-Policy-Report-Only.
 * Use this to monitor CSP violations without blocking content.
 * 
 * In production, you may want to:
 * - Log violations to a monitoring service (Sentry, LogRocket, etc.)
 * - Store in a database for analysis
 * - Send alerts for critical violations
 */

export async function POST(request: NextRequest) {
  try {
    const report = await request.json()

    // Log CSP violations for monitoring
    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.warn('[CSP VIOLATION]', JSON.stringify(report, null, 2))
    }

    // In production, you might want to:
    // - Send to logging service (Sentry, DataDog, etc.)
    // - Store in database
    // - Send alert for critical violations
    // Example:
    // await logCSPViolation(report)
    // if (isCriticalViolation(report)) {
    //   await sendAlert(report)
    // }

    // Return 204 No Content (CSP reporting expects this)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    // Don't fail on CSP report errors - they shouldn't break the app
    console.error('[CSP_REPORT_ERROR]', error)
    return new NextResponse(null, { status: 204 })
  }
}

// Allow OPTIONS for CORS preflight (if needed)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

