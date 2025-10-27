"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useFileUpload } from '@/hooks/use-file-upload'
import axios from "axios"
import qs from "query-string"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/dropzone'
import { useRouter } from "next/navigation"
import { useModal } from "@/hooks/use-modal-store"
import { ModalHeader } from "./_modal-header"

const formSchema = z.object({
  fileUrl: z.string().min(1, {
    message: "Attachment is required",
  }),
})

const MessageFileModal = () => {
  const { isOpen, type, onOpen, onClose, data } = useModal()
  const router = useRouter()

  const isModalOpen = isOpen && type === "messageFile"

  const { apiUrl, query } = data || {}

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileUrl: "",
    },
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log(values)
    try {
      const url = qs.stringifyUrl({
        url: data.apiUrl || "",
        // Ensures "query" is properly typed for qs (StringifiableRecord)
        query: query as Record<string, string | number | boolean | null | undefined> | undefined,
      })
      await axios.post(url, {
        ...values,
        content: values.fileUrl
      })

      form.reset()
      router.refresh()
      onClose()
    } catch (error) {
      console.error(error)
    }
  }

  const dropzoneProps = useFileUpload({
    bucketName: 'server-images',
    path: 'message-files',
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
  }, [dropzoneProps.files.length])

  // Watch for successful uploads and update the form field
  useEffect(() => {
    if (dropzoneProps.isSuccess && dropzoneProps.files.length > 0) {
      const uploadedFile = dropzoneProps.files[0]
      if (uploadedFile.uniqueFileName) {
        // Construct the public URL for the uploaded file
        const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/server-images/message-files/${uploadedFile.uniqueFileName}`
        form.setValue('fileUrl', imageUrl)
      }
    }
  }, [dropzoneProps.isSuccess, dropzoneProps.files, form])

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent>
        <ModalHeader title="Add an attachment" description="Add a file to your message." />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <FormField control={form.control} name="fileUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-zinc-500 dark:text-white">Server image</FormLabel>
                  <FormControl>
                    <Dropzone {...dropzoneProps} >
                      <DropzoneEmptyState />
                      <DropzoneContent />
                    </Dropzone>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter className="bg-gray-100 px-6 py-4">
              <Button disabled={isLoading} variant="primary">Send</Button>
            </DialogFooter>

          </form>
        </Form>
      </DialogContent>
    </Dialog >
  )
}

export default MessageFileModal