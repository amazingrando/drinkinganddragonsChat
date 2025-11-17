import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiting store
// For production, consider using Redis or a dedicated rate limiting service
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

interface RateLimitOptions {
  limit: number // Maximum number of requests
  windowMs: number // Time window in milliseconds
  identifier?: (req: NextRequest) => string | null | Promise<string | null> // Custom identifier function (can be async)
}

/**
 * Creates a rate limiting middleware function
 * @param options Rate limiting configuration
 * @returns Middleware function that returns 429 if rate limit exceeded
 */
export function rateLimit(options: RateLimitOptions) {
  const { limit, windowMs, identifier } = options

  return async (req: NextRequest): Promise<NextResponse | null> => {
    // Get identifier for this request (defaults to IP address)
    let id: string | null = null

    if (identifier) {
      const result = identifier(req)
      // Handle both sync and async identifiers
      id = result instanceof Promise ? await result : result
    } else {
      // Default: use IP address
      const forwarded = req.headers.get('x-forwarded-for')
      const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown'
      id = ip
    }

    if (!id || id === 'unknown') {
      // If we can't identify the user, allow the request but log a warning
      console.warn('[RATE_LIMIT] Could not identify request source')
      return null
    }

    const now = Date.now()
    const key = `${id}:${req.nextUrl.pathname}`
    const record = rateLimitStore.get(key)

    // Clean up expired records periodically (every 100 requests)
    if (Math.random() < 0.01) {
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetAt < now) {
          rateLimitStore.delete(k)
        }
      }
    }

    if (!record || record.resetAt < now) {
      // Create new record or reset expired one
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + windowMs,
      })
      return null // Allow request
    }

    if (record.count >= limit) {
      // Rate limit exceeded
      const remaining = Math.ceil((record.resetAt - now) / 1000)
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: remaining },
        {
          status: 429,
          headers: {
            'Retry-After': remaining.toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(record.resetAt).toISOString(),
          },
        }
      )
    }

    // Increment counter
    record.count++
    rateLimitStore.set(key, record)

    // Return null to allow the request
    return null
  }
}

/**
 * Rate limit presets for common use cases
 */
export const rateLimitPresets = {
  // Strict limits for authentication endpoints
  strict: rateLimit({
    limit: 5,
    windowMs: 15 * 60 * 1000, // 5 requests per 15 minutes
  }),

  // Moderate limits for write operations
  moderate: rateLimit({
    limit: 30,
    windowMs: 60 * 1000, // 30 requests per minute
  }),

  // Lenient limits for read operations
  lenient: rateLimit({
    limit: 100,
    windowMs: 60 * 1000, // 100 requests per minute
  }),

  // Custom rate limit for sign-up validation
  signUpValidation: rateLimit({
    limit: 10,
    windowMs: 60 * 1000, // 10 requests per minute
  }),
}

/**
 * Helper to identify authenticated users for rate limiting
 * Returns profile ID if authenticated, otherwise falls back to IP
 */
export function createAuthenticatedRateLimit(options: RateLimitOptions) {
  return rateLimit({
    ...options,
    identifier: async (req: NextRequest) => {
      // Try to get authenticated user ID
      try {
        const { currentProfile } = await import('@/lib/current-profile')
        const profile = await currentProfile()
        if (profile) {
          return profile.id
        }
      } catch {
        // Fall back to IP if we can't get profile
      }

      // Fallback to IP address
      const forwarded = req.headers.get('x-forwarded-for')
      return forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown'
    },
  })
}

