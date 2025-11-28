import { z } from 'zod'
import { NextResponse } from 'next/server'

/**
 * Common validation schemas for API endpoints
 */

// UUID validation
export const uuidSchema = z.string().uuid('Invalid ID format')

// Profile/Username validation
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be no more than 20 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')

// File upload validation
export const fileUploadSchema = z.object({
  files: z.array(
    z.object({
      name: z.string().min(1).max(255),
      size: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
      mimeType: z.string(),
      url: z.string().url(),
      bucketName: z.string(),
      path: z.string().optional(),
      profileId: z.string().uuid().optional(),
      serverId: z.string().uuid().optional(),
      channelId: z.string().uuid().optional(),
    })
  ),
})

// Server creation/update
export const serverSchema = z.object({
  name: z.string().min(1, 'Server name is required').max(100, 'Server name too long'),
  imageUrl: z.string().url().optional(),
})

// Channel creation/update
export const channelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(100, 'Channel name too long'),
  type: z.enum(['TEXT', 'AUDIO', 'VIDEO']),
  serverId: uuidSchema,
  description: z.string().max(500, 'Description too long').optional(),
})

// Message creation
export const messageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(2000, 'Message too long'),
  fileUrl: z.string().url().optional(),
  serverId: uuidSchema,
  channelId: uuidSchema,
  optimisticId: z.string().optional(),
})

// Poll creation
export const pollSchema = z.object({
  title: z.string().min(1, 'Poll title is required').max(200, 'Title too long'),
  options: z.array(z.string().min(1).max(100)).min(2, 'At least 2 options required').max(10, 'Too many options'),
  optionOrder: z.array(z.string().uuid()).optional(),
  allowMultipleChoices: z.boolean(),
  allowAddOptions: z.boolean(),
  durationHours: z.number().int().positive().max(168).optional(), // Max 7 days
  durationDays: z.number().int().positive().max(30).optional(),
  endDate: z.string().datetime().optional(),
  serverId: uuidSchema,
  channelId: uuidSchema,
})

// Poll vote
export const pollVoteSchema = z.object({
  optionId: uuidSchema,
  removeVote: z.boolean().optional(),
})

// Profile update
export const profileUpdateSchema = z.object({
  name: usernameSchema.optional(),
  imageUrl: z.string().url().or(z.literal('')).optional(),
})

// LiveKit token request
export const livekitTokenSchema = z.object({
  room: z.string().min(1),
  serverId: uuidSchema,
})

// Member role update
export const memberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']),
  serverId: uuidSchema,
})

/**
 * Helper function to validate request body with Zod schema
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @returns Validation result with parsed data or error
 */
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; details?: z.ZodError } {
  try {
    const parsed = schema.parse(data)
    return { success: true, data: parsed }
  } catch (error) {
    if (error instanceof z.ZodError) {
      // ZodError uses 'issues' property, not 'errors'
      const firstError = error.issues[0]
      const errorMessage = firstError?.message || 'Validation failed'
      return { success: false, error: errorMessage, details: error }
    }
    return { success: false, error: 'Invalid request data' }
  }
}

/**
 * Helper to create a NextResponse from validation errors
 */
export function validationErrorResponse(
  validation: { success: false; error: string; details?: z.ZodError }
): NextResponse {
  return NextResponse.json(
    {
      error: validation.error,
      details: process.env.NODE_ENV === 'development' ? validation.details?.issues : undefined,
    },
    { status: 400 }
  )
}

