/**
 * Secure error handling utilities
 * Prevents information disclosure by returning generic errors to clients
 * while logging detailed errors server-side
 */

/**
 * Secure error response that doesn't leak sensitive information
 * @param error The error object
 * @param context Context string for logging (e.g., '[FILES_POST]')
 * @param defaultMessage Default message to return to client
 * @returns NextResponse with a safe error message
 */
import { NextResponse } from 'next/server'

export function secureErrorResponse(
  error: unknown,
  context: string,
  defaultMessage = 'An error occurred'
): NextResponse {
  // Log detailed error server-side only
  if (error instanceof Error) {
    console.error(`${context}`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
  } else {
    console.error(`${context}`, error)
  }

  // Return generic error to client
  return NextResponse.json(
    { error: defaultMessage },
    { status: 500 }
  )
}

/**
 * Handle Prisma errors securely
 */
export function handlePrismaError(
  error: unknown,
  context: string
): NextResponse | null {
  if (error instanceof Error) {
    // Handle unique constraint violations
    if (error.message.includes('unique') || error.message.includes('Unique constraint')) {
      console.error(`${context} Unique constraint violation:`, error.message)
      return NextResponse.json(
        { error: 'This resource already exists' },
        { status: 409 }
      )
    }

    // Handle foreign key constraint violations
    if (error.message.includes('foreign key') || error.message.includes('Foreign key')) {
      console.error(`${context} Foreign key violation:`, error.message)
      return NextResponse.json(
        { error: 'Invalid reference to related resource' },
        { status: 400 }
      )
    }

    // Handle not found errors
    if (error.message.includes('Record to') || error.message.includes('not found')) {
      console.error(`${context} Record not found:`, error.message)
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      )
    }
  }

  return null
}

