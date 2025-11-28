"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFileUpload } from '@/hooks/use-file-upload'
import axios from "axios"

import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/dropzone'
import { useRouter } from "next/navigation"
import { useModal } from "@/hooks/use-modal-store"
import { useEffect } from "react"
import { X } from 'lucide-react'
import { ModalHeader } from "./_modal-header"
import Image from "next/image"

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Server name is required",
  }),
  imageUrl: z.string().min(1, {
    message: "Server image is required",
  }),
})

const EditServerModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()

  const isModalOpen = isOpen && type === "editServer"
  const { server } = data || {}

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      imageUrl: "",
    },
  })

  useEffect(() => {
    if (server) {
      if (server.name) {
        form.setValue('name', server.name)
      }
      if (server.imageUrl) {
        form.setValue('imageUrl', server.imageUrl)
      }
    }
  }, [server, form])

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log(values)
    try {
      await axios.patch(`/api/servers/${server?.id}`, values)

      form.reset()
      router.refresh()
      onClose()
    } catch (error) {
      console.error(error)
    }
  }

  const dropzoneProps = useFileUpload({
    bucketName: 'server-images',
    path: 'avatars',
    maxFiles: 1,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/*'],
    profileId: undefined, // Add actual profile ID when available
  })

  // Auto-upload when a file is added
  useEffect(() => {
    const filesWithoutErrors = dropzoneProps.files.filter(file => file.errors.length === 0)
    if (filesWithoutErrors.length > 0 && !dropzoneProps.loading && !dropzoneProps.isSuccess) {
      dropzoneProps.onUpload()
    }
  }, [dropzoneProps, dropzoneProps.files.length])

  // Watch for successful uploads and update the form field
  useEffect(() => {
    if (dropzoneProps.isSuccess && dropzoneProps.files.length > 0) {
      const uploadedFile = dropzoneProps.files[0]
      if (uploadedFile.uniqueFileName) {
        // Construct the public URL for the uploaded file
        const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/server-images/avatars/${uploadedFile.uniqueFileName}`
        form.setValue('imageUrl', imageUrl)
      }
    }
  }, [dropzoneProps.isSuccess, dropzoneProps.files, form])

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent>
        <ModalHeader title="Edit Server" description="Edit your server." />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold">Server name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      className=""
                      placeholder="Enter server name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="imageUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold">Server image</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      {/* Show existing image if present and no new upload is in progress */}
                      {server?.imageUrl && field.value === server.imageUrl && !dropzoneProps.isSuccess && (
                        <div className="relative">
                          <div className="flex items-center justify-center w-full h-48 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
                            <Image
                              src={server.imageUrl}
                              alt="Server image"
                              fill
                              className="object-contain"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              form.setValue('imageUrl', '')
                              dropzoneProps.setFiles([])
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Remove Image
                          </Button>
                        </div>
                      )}

                      {/* Show dropzone when no existing image or image was removed */}
                      {(!server?.imageUrl || field.value !== server.imageUrl) && (
                        <Dropzone {...dropzoneProps}>
                          <DropzoneEmptyState />
                          <DropzoneContent />
                        </Dropzone>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter className="px-6">
              <Button disabled={isLoading} variant="primary">Save Changes</Button>
            </DialogFooter>

          </form>
        </Form>
      </DialogContent>
    </Dialog >
  )
}

export default EditServerModal