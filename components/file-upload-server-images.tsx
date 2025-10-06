'use client'

import { useFileUpload } from '@/hooks/use-file-upload'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/dropzone'
import { useState, useEffect } from 'react'

interface FileUploadServerImagesProps {
  profileId?: string
  serverId?: string
  channelId?: string
  bucketName?: string
  path?: string
  maxFiles?: number
  maxFileSize?: number
  allowedMimeTypes?: string[]
}

export const FileUploadServerImages = ({
  profileId,
  serverId,
  channelId,
  bucketName = 'uploads',
  path = 'files',
  maxFiles = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedMimeTypes = ['image/*', 'application/pdf', 'text/*']
}: FileUploadServerImagesProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])

  const fileUpload = useFileUpload({
    bucketName,
    path,
    maxFiles,
    maxFileSize,
    allowedMimeTypes,
    profileId,
    serverId,
    channelId,
  })

  // Fetch existing files when component mounts
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const params = new URLSearchParams()
        if (profileId) params.append('profileId', profileId)
        if (serverId) params.append('serverId', serverId)
        if (channelId) params.append('channelId', channelId)

        const response = await fetch(`/api/files?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setUploadedFiles(data.files)
        }
      } catch (error) {
        console.error('Error fetching files:', error)
      }
    }

    fetchFiles()
  }, [profileId, serverId, channelId])

  // Refresh files list after successful upload
  useEffect(() => {
    if (fileUpload.isSuccess) {
      const fetchFiles = async () => {
        try {
          const params = new URLSearchParams()
          if (profileId) params.append('profileId', profileId)
          if (serverId) params.append('serverId', serverId)
          if (channelId) params.append('channelId', channelId)

          const response = await fetch(`/api/files?${params.toString()}`)
          if (response.ok) {
            const data = await response.json()
            setUploadedFiles(data.files)
          }
        } catch (error) {
          console.error('Error fetching files:', error)
        }
      }

      fetchFiles()
    }
  }, [fileUpload.isSuccess, profileId, serverId, channelId])

  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files?id=${fileId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
      }
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Upload Files</h3>
        <Dropzone {...fileUpload}>
          <DropzoneEmptyState />
          <DropzoneContent />
        </Dropzone>
      </div>

      {uploadedFiles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Uploaded Files</h3>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                    📄
                  </div>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB • {file.mimeType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
