"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect } from "react"
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
import { ModalHeader } from "./_modal-header"

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Server name is required",
  }),
  imageUrl: z.string().min(1, {
    message: "Server image is required",
  }),
})

const InitialModal = () => {
  const [isMounted, setIsMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      imageUrl: "",
    },
  })

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log(values)
    try {
      await axios.post("/api/servers", values)

      form.reset()
      router.refresh()
      window.location.reload()
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

  if (!isMounted) {
    return null
  }

  return (
    <Dialog open={true} onOpenChange={() => { }}>
      <DialogContent>
        <ModalHeader title="Create a Server" description="Create a server to get started." />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-zinc-500 dark:text-white">Server name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
                      placeholder="Enter server name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="imageUrl" render={({ }) => (
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
              <Button disabled={isLoading} variant="primary">Create Server</Button>
            </DialogFooter>

          </form>
        </Form>
      </DialogContent>
    </Dialog >
  )
}

export default InitialModal