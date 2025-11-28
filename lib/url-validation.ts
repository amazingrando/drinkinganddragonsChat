/**
 * URL validation utilities for security
 * 
 * Prevents XSS attacks via malicious URL protocols by:
 * - Only allowing safe protocols (http://, https://, mailto:)
 * - Rejecting dangerous protocols (javascript:, data:, vbscript:, file:, etc.)
 * - Rejecting protocol-relative URLs (//example.com)
 * - Handling URL encoding to prevent encoded protocol attacks
 * - Validating UUIDs to prevent path traversal and injection attacks
 */

/**
 * Validates that a URL uses a safe protocol
 * Only allows http://, https://, and optionally mailto:
 * Rejects javascript:, data:, vbscript:, and other dangerous protocols
 * 
 * Security considerations:
 * - Explicitly rejects protocol-relative URLs (//example.com) to prevent protocol confusion
 * - Handles URL encoding by decoding before validation
 * - Validates protocol after parsing to catch encoded protocol attacks
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Trim whitespace
  let trimmed = url.trim()
  
  // Reject protocol-relative URLs (//example.com) - these can be dangerous
  if (trimmed.startsWith('//')) {
    return false
  }

  // Decode URL encoding to catch encoded protocol attacks (e.g., javascript%3A)
  try {
    // Only decode once to prevent double-encoding attacks
    trimmed = decodeURIComponent(trimmed)
  } catch {
    // If decoding fails, continue with original string
    // This handles cases where the URL isn't properly encoded
  }

  const lowerUrl = trimmed.toLowerCase()

  // Check for allowed protocols
  const allowedProtocols = ['http://', 'https://', 'mailto:']
  
  // Must start with an allowed protocol
  const hasValidProtocol = allowedProtocols.some((protocol) =>
    lowerUrl.startsWith(protocol),
  )

  if (!hasValidProtocol) {
    return false
  }

  // Additional validation: try to parse as URL (for http/https)
  if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed)
      // Ensure it's actually http or https (not javascript:http://...)
      // Also check that protocol matches after parsing (catches encoded protocols)
      const protocol = parsed.protocol.toLowerCase()
      return (protocol === 'http:' || protocol === 'https:') && 
             (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://'))
    } catch {
      return false
    }
  }

  // For mailto:, basic validation
  if (lowerUrl.startsWith('mailto:')) {
    // mailto: should have at least mailto: and something after
    if (trimmed.length <= 7) {
      return false
    }
    // Basic validation that mailto: is followed by something reasonable
    const afterMailto = trimmed.slice(7)
    // Reject if it looks like it might be trying to inject a protocol
    // Reject protocol-relative URLs (mailto://)
    if (afterMailto.startsWith('//') || 
        afterMailto.includes('://') || 
        afterMailto.includes('javascript:') || 
        afterMailto.includes('data:')) {
      return false
    }
    return true
  }

  return true
}

/**
 * Validates and sanitizes a URL, returning null if invalid
 */
export function validateUrl(url: string): string | null {
  if (isValidUrl(url)) {
    return url.trim()
  }
  return null
}

/**
 * Validates that a string is a valid UUID format
 */
export function isValidUuid(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false
  }

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

