/**
 * Server-side file upload validation
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  // Office documents
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf',
  '.txt', '.md',
  '.doc', '.docx', '.xls', '.xlsx',
]

/**
 * Validates file MIME type
 */
export function validateMimeType(mimeType: string): { valid: boolean; error?: string } {
  if (!mimeType || typeof mimeType !== 'string') {
    return { valid: false, error: 'Invalid MIME type' }
  }

  // Check exact match first
  if (ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: true }
  }

  // Check if it's an image type (wildcard)
  if (mimeType.startsWith('image/')) {
    const specificType = mimeType.split('/')[1]
    if (['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg+xml'].includes(specificType)) {
      return { valid: true }
    }
  }

  return { valid: false, error: 'File type not allowed' }
}

/**
 * Validates file size
 */
export function validateFileSize(size: number, maxSize = MAX_FILE_SIZE): { valid: boolean; error?: string } {
  if (typeof size !== 'number' || size <= 0) {
    return { valid: false, error: 'Invalid file size' }
  }

  if (size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
    return { valid: false, error: `File size exceeds maximum of ${maxSizeMB}MB` }
  }

  return { valid: true }
}

/**
 * Validates and sanitizes file name to prevent path traversal
 */
export function validateFileName(fileName: string): { valid: boolean; sanitized?: string; error?: string } {
  if (!fileName || typeof fileName !== 'string') {
    return { valid: false, error: 'Invalid file name' }
  }

  // Remove path traversal attempts
  let sanitized = fileName
    .replace(/\.\./g, '') // Remove ..
    .replace(/[\/\\]/g, '_') // Replace / and \ with _
    .trim()

  // Check for empty name after sanitization
  if (!sanitized) {
    return { valid: false, error: 'Invalid file name after sanitization' }
  }

  // Check file extension
  const extension = sanitized.toLowerCase().substring(sanitized.lastIndexOf('.'))
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'File extension not allowed' }
  }

  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 250) + extension
  }

  return { valid: true, sanitized }
}

/**
 * Validates file URL to ensure it's from allowed storage buckets
 */
export function validateFileUrl(url: string, allowedBuckets = ['avatars', 'server-images', 'uploads']): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Invalid file URL' }
  }

  // Check if URL is from Supabase storage
  const supabaseStoragePattern = /\/storage\/v1\/object\/(public|private)\/([^\/]+)/
  const match = url.match(supabaseStoragePattern)

  if (!match) {
    return { valid: false, error: 'Invalid storage URL format' }
  }

  const bucketName = match[2]
  if (!allowedBuckets.includes(bucketName)) {
    return { valid: false, error: 'File from unauthorized storage bucket' }
  }

  return { valid: true }
}

/**
 * Comprehensive file validation
 */
export interface FileValidationResult {
  valid: boolean
  errors: string[]
  sanitizedFileName?: string
}

export function validateFile(
  fileName: string,
  mimeType: string,
  size: number,
  url?: string,
  maxSize = MAX_FILE_SIZE
): FileValidationResult {
  const errors: string[] = []

  // Validate file name
  const nameValidation = validateFileName(fileName)
  if (!nameValidation.valid) {
    errors.push(nameValidation.error || 'Invalid file name')
  }

  // Validate MIME type
  const mimeValidation = validateMimeType(mimeType)
  if (!mimeValidation.valid) {
    errors.push(mimeValidation.error || 'Invalid file type')
  }

  // Validate file size
  const sizeValidation = validateFileSize(size, maxSize)
  if (!sizeValidation.valid) {
    errors.push(sizeValidation.error || 'File too large')
  }

  // Validate URL if provided
  if (url) {
    const urlValidation = validateFileUrl(url)
    if (!urlValidation.valid) {
      errors.push(urlValidation.error || 'Invalid file URL')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedFileName: nameValidation.sanitized,
  }
}

