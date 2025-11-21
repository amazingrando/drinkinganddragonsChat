/**
 * Content Security Policy (CSP) Configuration
 * 
 * Provides environment-based CSP policies with nonce support for production security.
 * In development, uses more permissive policies. In production, uses strict policies with nonces.
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

/**
 * Generate a cryptographically secure random nonce
 * Uses Web Crypto API which is available in Edge Runtime
 */
export function generateNonce(): string {
  // Web Crypto API is available in Edge Runtime
  const array = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
    // Convert Uint8Array to base64 using btoa (available in Edge Runtime)
    // Convert to binary string (chunk to avoid call stack issues)
    let binaryString = ''
    for (let i = 0; i < array.length; i++) {
      binaryString += String.fromCharCode(array[i])
    }
    return btoa(binaryString)
  }
  // Fallback for environments without Web Crypto API (shouldn't happen in Edge)
  // This is a simple fallback - in practice this won't be used in Edge Runtime
  let result = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Get nonce from request headers (set by middleware) or generate a new one
 */
export function getNonceFromHeaders(nonceHeader?: string | null): string {
  return nonceHeader || generateNonce()
}

interface CSPDirectives {
  'default-src': string[]
  'script-src': string[]
  'style-src': string[]
  'img-src': string[]
  'font-src': string[]
  'connect-src': string[]
  'frame-src': string[]
  'media-src': string[]
  'object-src': string[]
  'base-uri': string[]
  'form-action': string[]
  'frame-ancestors': string[]
  'upgrade-insecure-requests'?: string[]
  'report-uri'?: string[]
  'report-to'?: string[]
}

/**
 * Build CSP header string from directives
 */
function buildCSPHeader(directives: Partial<CSPDirectives>, nonce?: string): string {
  const parts: string[] = []

  // Add nonce to script-src and style-src if provided
  const scriptSrc = directives['script-src'] || []
  const styleSrc = directives['style-src'] || []

  if (nonce && isProduction) {
    // In production, use nonce-based CSP
    parts.push(`default-src ${(directives['default-src'] || ["'self'"]).join(' ')}`)
    parts.push(`script-src ${[...scriptSrc.filter(s => !s.includes('unsafe')), `'nonce-${nonce}'`].join(' ')}`)
    parts.push(`style-src ${[...styleSrc.filter(s => !s.includes('unsafe')), `'nonce-${nonce}'`, "'unsafe-inline'"].join(' ')}`)
  } else {
    // Development or no nonce - use permissive policies
    parts.push(`default-src ${(directives['default-src'] || ["'self'"]).join(' ')}`)
    parts.push(`script-src ${scriptSrc.join(' ')}`)
    parts.push(`style-src ${styleSrc.join(' ')}`)
  }

  // Add remaining directives
  if (directives['img-src']) {
    parts.push(`img-src ${directives['img-src'].join(' ')}`)
  }
  if (directives['font-src']) {
    parts.push(`font-src ${directives['font-src'].join(' ')}`)
  }
  if (directives['connect-src']) {
    parts.push(`connect-src ${directives['connect-src'].join(' ')}`)
  }
  if (directives['frame-src']) {
    parts.push(`frame-src ${directives['frame-src'].join(' ')}`)
  }
  if (directives['media-src']) {
    parts.push(`media-src ${directives['media-src'].join(' ')}`)
  }
  if (directives['object-src']) {
    parts.push(`object-src ${directives['object-src'].join(' ')}`)
  }
  if (directives['base-uri']) {
    parts.push(`base-uri ${directives['base-uri'].join(' ')}`)
  }
  if (directives['form-action']) {
    parts.push(`form-action ${directives['form-action'].join(' ')}`)
  }
  if (directives['frame-ancestors']) {
    parts.push(`frame-ancestors ${directives['frame-ancestors'].join(' ')}`)
  }
  if (directives['upgrade-insecure-requests']) {
    parts.push('upgrade-insecure-requests')
  }
  if (directives['report-uri'] && isProduction) {
    parts.push(`report-uri ${directives['report-uri'].join(' ')}`)
  }
  if (directives['report-to'] && isProduction) {
    parts.push(`report-to ${directives['report-to'].join(' ')}`)
  }

  return parts.join('; ')
}

/**
 * Get CSP policy based on environment
 */
export function getCSPPolicy(nonce?: string): string {
  if (isDevelopment) {
    // Development: More permissive for easier debugging
    return buildCSPHeader(
      {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Next.js dev mode
        'style-src': ["'self'", "'unsafe-inline'"], // Required for Tailwind CSS and CSS-in-JS
        'img-src': ["'self'", 'data:', 'https:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': [
          "'self'",
          'https://*.supabase.co',
          'wss://*.supabase.co',
          'https://*.livekit.cloud',
          'wss://*.livekit.cloud',
          'ws://localhost:*', // Allow WebSocket connections in dev
          'http://localhost:*', // Allow localhost connections in dev
        ],
        'frame-src': ["'self'", 'https://*.livekit.cloud'],
        'media-src': ["'self'", 'blob:', 'https://*.livekit.cloud'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'"],
        // No upgrade-insecure-requests in dev (allows http://localhost)
      },
      nonce
    )
  }

  // Production: Strict policy with nonce support
  return buildCSPHeader(
    {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        // In production with nonce, unsafe-inline and unsafe-eval should NOT be needed
        // Next.js should handle script loading with nonces
        // If you still need them, consider using 'strict-dynamic' with nonces
        ...(nonce ? [] : ["'unsafe-inline'", "'unsafe-eval'"]), // Fallback if no nonce
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Still needed for CSS-in-JS libraries like Tailwind
        // Consider moving to styled-components or emotion with nonce support if possible
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:', // For user-uploaded images
      ],
      'font-src': ["'self'", 'data:', 'https:'],
      'connect-src': [
        "'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        'https://*.livekit.cloud',
        'wss://*.livekit.cloud',
      ],
      'frame-src': ["'self'", 'https://*.livekit.cloud'],
      'media-src': ["'self'", 'blob:', 'https://*.livekit.cloud'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
      'upgrade-insecure-requests': [],
      // Optional: Add CSP reporting endpoint
      // 'report-uri': ['/api/csp-report'],
      // 'report-to': ['csp-endpoint'],
    },
    nonce
  )
}

/**
 * Get Content-Security-Policy-Report-Only header for testing
 * Use this to test CSP policies without blocking content
 */
export function getCSPReportOnlyPolicy(nonce?: string): string {
  const policy = getCSPPolicy(nonce)
  // Add report-uri to report-only policy
  return policy + '; report-uri /api/csp-report'
}

