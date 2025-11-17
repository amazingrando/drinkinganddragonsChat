import { db } from "@/lib/db"
import { isUsernameBlacklisted } from "@/lib/username-blacklist"

export type UsernameValidationError =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_CHARACTERS"
  | "BLACKLISTED"
  | "ALREADY_TAKEN"
  | "EMPTY"

export interface UsernameValidationResult {
  valid: boolean
  error?: UsernameValidationError
  message?: string
}

/**
 * Validates username format: 3-20 characters, alphanumeric + underscores/hyphens
 */
function validateFormat(username: string): UsernameValidationResult {
  const trimmed = username.trim()

  if (!trimmed) {
    return {
      valid: false,
      error: "EMPTY",
      message: "Username cannot be empty",
    }
  }

  if (trimmed.length < 3) {
    return {
      valid: false,
      error: "TOO_SHORT",
      message: "Username must be at least 3 characters long",
    }
  }

  if (trimmed.length > 20) {
    return {
      valid: false,
      error: "TOO_LONG",
      message: "Username must be no more than 20 characters long",
    }
  }

  // Allow alphanumeric, underscores, and hyphens
  const validPattern = /^[a-zA-Z0-9_-]+$/
  if (!validPattern.test(trimmed)) {
    return {
      valid: false,
      error: "INVALID_CHARACTERS",
      message:
        "Username can only contain letters, numbers, underscores, and hyphens",
    }
  }

  return { valid: true }
}

/**
 * Validates username against blacklist (case-insensitive)
 */
function validateBlacklist(username: string): UsernameValidationResult {
  if (isUsernameBlacklisted(username)) {
    return {
      valid: false,
      error: "BLACKLISTED",
      message: "This username is not available",
    }
  }

  return { valid: true }
}

/**
 * Checks if username is already taken (case-insensitive)
 * @param username - The username to check
 * @param excludeProfileId - Optional profile ID to exclude from check (for updates)
 */
async function validateUniqueness(
  username: string,
  excludeProfileId?: string
): Promise<UsernameValidationResult> {
  const lowerUsername = username.toLowerCase().trim()

  // Use raw query for case-insensitive comparison
  // This works with the unique index on LOWER(name)
  let existing: Array<{ id: string }>
  
  if (excludeProfileId) {
    existing = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Profile"
      WHERE LOWER(name) = LOWER(${lowerUsername})
        AND id != ${excludeProfileId}
      LIMIT 1
    `
  } else {
    existing = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Profile"
      WHERE LOWER(name) = LOWER(${lowerUsername})
      LIMIT 1
    `
  }

  if (existing && existing.length > 0) {
    return {
      valid: false,
      error: "ALREADY_TAKEN",
      message: "This username is already taken",
    }
  }

  return { valid: true }
}

/**
 * Validates a username with all checks: format, blacklist, and uniqueness
 * @param username - The username to validate
 * @param excludeProfileId - Optional profile ID to exclude from uniqueness check (for updates)
 */
export async function validateUsername(
  username: string,
  excludeProfileId?: string
): Promise<UsernameValidationResult> {
  // Format validation
  const formatCheck = validateFormat(username)
  if (!formatCheck.valid) {
    return formatCheck
  }

  // Blacklist validation
  const blacklistCheck = validateBlacklist(username)
  if (!blacklistCheck.valid) {
    return blacklistCheck
  }

  // Uniqueness validation
  const uniquenessCheck = await validateUniqueness(username, excludeProfileId)
  if (!uniquenessCheck.valid) {
    return uniquenessCheck
  }

  return { valid: true }
}

