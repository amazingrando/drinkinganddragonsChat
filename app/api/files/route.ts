import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { files } = await request.json()
    
    if (!files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: 'Files array is required' },
        { status: 400 }
      )
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
    console.error('Error creating file records:', error)
    return NextResponse.json(
      { error: 'Failed to create file records' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')
    const serverId = searchParams.get('serverId')
    const channelId = searchParams.get('channelId')
    
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
    console.error('Error fetching files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
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
    console.error('Error deleting file:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}
