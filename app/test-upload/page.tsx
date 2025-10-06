'use client'

import { FileUploadServerImages } from '@/components/file-upload-server-images'
import { useState } from 'react'

export default function TestUploadPage() {
  const [profileId, setProfileId] = useState('')
  const [serverId, setServerId] = useState('')
  const [channelId, setChannelId] = useState('')

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">File Upload Test</h1>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Configuration (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Profile ID</label>
            <input
              type="text"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="Enter profile ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Server ID</label>
            <input
              type="text"
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="Enter server ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Channel ID</label>
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="Enter channel ID"
            />
          </div>
        </div>
      </div>

      <FileUploadServerImages
        profileId={profileId || undefined}
        serverId={serverId || undefined}
        channelId={channelId || undefined}
        bucketName="server-images"
        path="demo"
        maxFiles={3}
        maxFileSize={5 * 1024 * 1024} // 5MB
        allowedMimeTypes={['image/*', 'application/pdf', 'text/*']}
      />

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">How it works:</h3>
        <ul className="text-sm space-y-1">
          <li>• Files are uploaded to Supabase Storage</li>
          <li>• File metadata is stored in your PostgreSQL database via Prisma</li>
          <li>• Files can be associated with profiles, servers, or channels</li>
          <li>• You can query files by their relationships</li>
          <li>• Files are automatically cleaned up when related records are deleted</li>
        </ul>
      </div>
    </div>
  )
}
