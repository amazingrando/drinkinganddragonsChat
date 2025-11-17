/**
 * Blacklist of usernames that cannot be used.
 * All comparisons are case-insensitive.
 */
export const USERNAME_BLACKLIST = [
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'info',
  'contact',
  'noreply',
  'no-reply',
  'api',
  'www',
  'mail',
  'email',
  'test',
  'testing',
  'null',
  'undefined',
  'guest',
  'anonymous',
  'moderator',
  'mod',
  'owner',
  'staff',
  'team',
  'official',
  'verify',
  'verified',
  'security',
  'privacy',
  'terms',
  'legal',
  'abuse',
  'spam',
  'bot',
  'service',
  'services',
] as const

/**
 * Check if a username is blacklisted (case-insensitive)
 */
export function isUsernameBlacklisted(username: string): boolean {
  const lowerUsername = username.toLowerCase().trim()
  return USERNAME_BLACKLIST.some(
    (blacklisted) => blacklisted.toLowerCase() === lowerUsername
  )
}

