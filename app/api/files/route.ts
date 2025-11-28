import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { currentProfile } from '@/lib/current-profile'
import { rateLimitPresets } from '@/lib/rate-limit'
import { csrfProtection } from '@/lib/csrf'
import { fileUploadSchema, validateRequestBody, validationErrorResponse } from '@/lib/validation'
import { secureErrorResponse, handlePrismaError } from '@/lib/error-handling'
import { validateFile } from '@/lib/file-upload-validation'
import { canDeleteFile } from '@/lib/authorization'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.moderate(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) {
    return csrfResponse
  }

  try {
    const profile = await currentProfile()

    if (!profile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate request body with Zod
    const validation = validateRequestBody(fileUploadSchema, body)
    if (!validation.success) {
      return validationErrorResponse(validation)
    }

    const { files } = validation.data

    // Server-side validation of each file
    for (const file of files) {
      const fileValidation = validateFile(
        file.name,
        file.mimeType,
        file.size,
        file.url
      )

      if (!fileValidation.valid) {
        return NextResponse.json(
          { error: 'File validation failed', details: fileValidation.errors },
          { status: 400 }
        )
      }

      // Use sanitized file name if provided
      if (fileValidation.sanitizedFileName && fileValidation.sanitizedFileName !== file.name) {
        file.name = fileValidation.sanitizedFileName
      }
    }

    // Verify user has permission to upload files for each specified server/channel
    for (const file of files) {
      if (file.serverId) {
        const server = await db.server.findFirst({
          where: {
            id: file.serverId,
            members: { some: { profileID: profile.id } },
          },
        })

        if (!server) {
          return NextResponse.json(
            { error: 'Server not found or access denied' },
            { status: 403 }
          )
        }
      }

      if (file.channelId && file.serverId) {
        const channel = await db.channel.findFirst({
          where: {
            id: file.channelId,
            serverID: file.serverId,
          },
          include: {
            server: {
              include: {
                members: {
                  where: { profileID: profile.id },
                },
              },
            },
          },
        })

        if (!channel || channel.server.members.length === 0) {
          return NextResponse.json(
            { error: 'Channel not found or access denied' },
            { status: 403 }
          )
        }
      }

      if (file.profileId && file.profileId !== profile.id) {
        return NextResponse.json(
          { error: 'Cannot upload files for other users' },
          { status: 403 }
        )
      }

      // Ensure profileId matches authenticated user
      file.profileId = profile.id
    }
    
    const createdFiles = await db.file.createMany({
      data: files,
    })
    
    return NextResponse.json({ 
      success: true, 
      count: createdFiles.count,
      files: createdFiles 
    })
  } catch (error) {
    const prismaError = handlePrismaError(error, '[FILES_POST]')
    if (prismaError) {
      return prismaError
    }
    return secureErrorResponse(error, '[FILES_POST]', 'Failed to create file records')
  }
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.lenient(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const profile = await currentProfile()

    if (!profile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')
    const serverId = searchParams.get('serverId')
    const channelId = searchParams.get('channelId')

    // Verify access permissions
    if (profileId && profileId !== profile.id) {
      return NextResponse.json(
        { error: 'Cannot access other users\' files' },
        { status: 403 }
      )
    }

    if (serverId) {
      const server = await db.server.findFirst({
        where: {
          id: serverId,
          members: { some: { profileID: profile.id } },
        },
      })

      if (!server) {
        return NextResponse.json(
          { error: 'Server not found or access denied' },
          { status: 403 }
        )
      }
    }

    if (channelId && serverId) {
      const channel = await db.channel.findFirst({
        where: {
          id: channelId,
          serverID: serverId,
        },
        include: {
          server: {
            include: {
              members: {
                where: { profileID: profile.id },
              },
            },
          },
        },
      })

      if (!channel || channel.server.members.length === 0) {
        return NextResponse.json(
          { error: 'Channel not found or access denied' },
          { status: 403 }
        )
      }
    }
    
    const whereClause: Record<string, string | undefined> = {}
    
    if (profileId) whereClause.profileId = profileId
    if (serverId) whereClause.serverId = serverId
    if (channelId) whereClause.channelId = channelId
    
    const files = await db.file.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            imageUrl: true
          }
        },
        server: {
          select: {
            id: true,
            name: true
          }
        },
        channel: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })
    
    return NextResponse.json({ files })
  } catch (error) {
    return secureErrorResponse(error, '[FILES_GET]', 'Failed to fetch files')
  }
}

export async function DELETE(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitPresets.moderate(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) {
    return csrfResponse
  }

  try {
    const profile = await currentProfile()

    if (!profile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    // Check authorization using helper function
    const authorization = await canDeleteFile(profile.id, fileId)

    if (!authorization.canDelete) {
      return NextResponse.json(
        { error: authorization.reason || 'Unauthorized to delete this file' },
        { status: authorization.reason === 'File not found' ? 404 : 403 }
      )
    }
    
    const deletedFile = await db.file.delete({
      where: { id: fileId }
    })
    
    return NextResponse.json({ 
      success: true, 
      file: deletedFile 
    })
  } catch (error) {
    const prismaError = handlePrismaError(error, '[FILES_DELETE]')
    if (prismaError) {
      return prismaError
    }
    return secureErrorResponse(error, '[FILES_DELETE]', 'Failed to delete file')
  }
}
