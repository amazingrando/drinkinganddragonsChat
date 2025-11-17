import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes, createHmac } from 'crypto'

const CSRF_SECRET = process.env.CSRF_SECRET || 'change-me-in-production'
const CSRF_TOKEN_HEADER = 'x-csrf-token'
const CSRF_TOKEN_COOKIE = 'csrf-token'

/**
 * Generates a CSRF token and sets it as a cookie
 * @returns The CSRF token
 */
export async function generateCsrfToken(): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const cookieStore = await cookies()
  
  // Create HMAC of token with secret
  const hmac = createHmac('sha256', CSRF_SECRET)
  hmac.update(token)
  const signedToken = `${token}.${hmac.digest('hex')}`

  cookieStore.set(CSRF_TOKEN_COOKIE, signedToken, {
    httpOnly: false, // Must be accessible to JavaScript for client-side requests
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return signedToken
}

/**
 * Validates a CSRF token from the request
 * @param request The incoming request
 * @returns true if valid, false otherwise
 */
export async function validateCsrfToken(request: NextRequest): Promise<boolean> {
  // Get token from header
  const tokenFromHeader = request.headers.get(CSRF_TOKEN_HEADER)
  
  // Get token from cookie
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get(CSRF_TOKEN_COOKIE)?.value

  if (!tokenFromHeader || !tokenFromCookie) {
    return false
  }

  // Tokens must match
  if (tokenFromHeader !== tokenFromCookie) {
    return false
  }

  // Verify HMAC
  const [token, hmac] = tokenFromHeader.split('.')
  if (!token || !hmac) {
    return false
  }

  const expectedHmac = createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex')

  return hmac === expectedHmac
}

/**
 * CSRF protection middleware for API routes
 * Use this for state-changing operations (POST, PATCH, DELETE, PUT)
 * 
 * Note: GET requests are generally safe from CSRF and don't need this protection
 * 
 * @param request The incoming request
 * @returns NextResponse with 403 if CSRF check fails, null if valid
 */
export async function csrfProtection(
  request: NextRequest
): Promise<NextResponse | null> {
  // Only protect state-changing methods
  const protectedMethods = ['POST', 'PATCH', 'DELETE', 'PUT']
  if (!protectedMethods.includes(request.method)) {
    return null
  }

  // Skip CSRF check for public endpoints that don't require authentication
  const publicEndpoints = [
    '/api/invite/validate',
    '/api/sign-up/validate',
  ]
  
  if (publicEndpoints.some(endpoint => request.nextUrl.pathname === endpoint)) {
    return null
  }

  const isValid = await validateCsrfToken(request)
  
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Helper to add CSRF token to fetch requests from the client
 * This should be called on the client side before making state-changing requests
 */
export async function getCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    })
    
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.token
  } catch {
    return null
  }
}

