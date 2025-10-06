import { useSupabaseUpload, type UseSupabaseUploadOptions } from './use-supabase-upload'
import { useCallback } from 'react'

interface UseFileUploadOptions extends UseSupabaseUploadOptions {
  // New Prisma-specific options
  profileId?: string
  serverId?: string
  channelId?: string
}

export const useFileUpload = (options: UseFileUploadOptions) => {
  const supabaseUpload = useSupabaseUpload(options)
  
  const onUploadWithPrisma = useCallback(async () => {
    // First upload to Supabase
    await supabaseUpload.onUpload()
    
    // If upload was successful, save metadata to Prisma
    if (supabaseUpload.isSuccess) {
      try {
        const response = await fetch('/api/files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: supabaseUpload.files.map(file => ({
              name: file.name, // Keep original name for display
              size: file.size,
              mimeType: file.type,
              // Use unique filename for the URL
              url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${options.bucketName}/${options.path ? `${options.path}/` : ''}${file.uniqueFileName || file.name}`,
              bucketName: options.bucketName,
              path: options.path,
              profileId: options.profileId,
              serverId: options.serverId,
              channelId: options.channelId,
            }))
          })
        })
        
        if (!response.ok) {
          throw new Error('Failed to save file metadata')
        }
        
        const result = await response.json()
        console.log('File metadata saved successfully:', result)
      } catch (error) {
        console.error('Error saving file metadata:', error)
        // You might want to show a notification to the user here
        // For now, we'll just log the error
      }
    }
  }, [supabaseUpload, options])
  
  return {
    ...supabaseUpload,
    onUpload: onUploadWithPrisma,
  }
}

export type { UseFileUploadOptions }
