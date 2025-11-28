/**
 * URL validation utilities for security
 * Prevents XSS attacks via malicious URL protocols
 */

/**
 * Validates that a URL uses a safe protocol
 * Only allows http://, https://, and optionally mailto:
 * Rejects javascript:, data:, vbscript:, and other dangerous protocols
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Trim whitespace
  const trimmed = url.trim()

  // Check for allowed protocols
  const allowedProtocols = ['http://', 'https://', 'mailto:']
  const lowerUrl = trimmed.toLowerCase()

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
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  // For mailto:, basic validation
  if (lowerUrl.startsWith('mailto:')) {
    // mailto: should have at least mailto: and something after
    return trimmed.length > 7
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

