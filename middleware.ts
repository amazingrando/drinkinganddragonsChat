import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { generateNonce, getCSPPolicy, getCSPReportOnlyPolicy } from '@/lib/csp'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  // Generate nonce for this request (Next.js 15 will handle nonce injection)
  const nonce = generateNonce()
  
  // Store nonce in request headers for Next.js to use
  request.headers.set('x-nonce', nonce)

  // Determine if we're in CSP report-only mode (for testing)
  // Set NEXT_PUBLIC_CSP_REPORT_ONLY=true in .env.local to test CSP without blocking
  const cspReportOnly = process.env.NEXT_PUBLIC_CSP_REPORT_ONLY === 'true'

  // Add security headers to all responses
  const securityHeaders: Record<string, string> = {
    'X-DNS-Prefetch-Control': 'on',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // Add nonce to response headers for Next.js to inject into scripts/styles
    'x-nonce': nonce,
  }

  // Add CSP header (report-only for testing, or enforced for production)
  if (cspReportOnly) {
    securityHeaders['Content-Security-Policy-Report-Only'] = getCSPReportOnlyPolicy(nonce)
  } else {
    securityHeaders['Content-Security-Policy'] = getCSPPolicy(nonce)
  }

  // Apply headers to response
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    // Exclude API routes so unauthenticated clients can call public endpoints like invite validation
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
