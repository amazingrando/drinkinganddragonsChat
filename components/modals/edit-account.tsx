"use client"

import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios, { isAxiosError } from "axios"
import { axiosClient } from "@/lib/axios-client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useFileUpload } from '@/hooks/use-file-upload'
import { Trash2 } from "lucide-react"

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
import { useModal } from "@/hooks/use-modal-store"
import { ModalHeader } from "./_modal-header"
import UserAvatar from "../user-avatar"

const formSchema = z.object({
  name: z
    .string()
    .min(3, {
      message: "Username must be at least 3 characters long",
    })
    .max(20, {
      message: "Username must be no more than 20 characters long",
    })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message:
        "Username can only contain letters, numbers, underscores, and hyphens",
    }),
  imageUrl: z.string().optional(),
})

const EditAccountModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const prevModalOpenRef = useRef(false)

  const isModalOpen = isOpen && type === "account"
  const { profile } = data || {}

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      imageUrl: "",
    },
  })

  const dropzoneProps = useFileUpload({
    bucketName: 'avatars',
    maxFiles: 1,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/*'],
    profileId: profile?.id,
  })

  // Reset form and state when modal opens or closes
  useEffect(() => {
    const wasOpen = prevModalOpenRef.current
    prevModalOpenRef.current = isModalOpen

    if (!isModalOpen) {
      // When modal closes, reset everything
      if (wasOpen) {
        form.reset({
          name: "",
          imageUrl: "",
        })
        setCurrentImageUrl(null)
        dropzoneProps.setFiles([])
        dropzoneProps.setErrors([])
      }
      return
    }

    // When modal opens (transition from closed to open)
    if (!wasOpen && profile) {
      // Reset form with current profile data when modal opens
      form.reset({
        name: profile.name || "",
        imageUrl: profile.imageUrl || "",
      })
      setCurrentImageUrl(profile.imageUrl || null)
      // Reset dropzone state to clear any previous upload state
      dropzoneProps.setFiles([])
      dropzoneProps.setErrors([])
    } else if (isModalOpen && profile) {
      // Also update if profile data changes while modal is open
      form.setValue("name", profile.name || "")
      form.setValue("imageUrl", profile.imageUrl || "")
      setCurrentImageUrl(profile.imageUrl || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, profile?.id, profile?.name, profile?.imageUrl]) // Use specific profile fields to avoid unnecessary re-runs

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
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const imageUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${uploadedFile.uniqueFileName}`
        form.setValue('imageUrl', imageUrl)
        setCurrentImageUrl(imageUrl)
      }
    }
  }, [dropzoneProps.isSuccess, dropzoneProps.files, form])

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setError(null)
      const payload: { name?: string; imageUrl?: string } = {
        name: values.name,
      }
      
      // Only include imageUrl if it has a value, otherwise send empty string to clear it
      if (values.imageUrl !== undefined) {
        payload.imageUrl = values.imageUrl || ''
      }
      
      const response = await axiosClient.patch("/api/profile", payload)

      form.reset()
      dropzoneProps.setFiles([])
      
      // Dispatch custom event to notify all components of profile update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profile-updated', { 
          detail: response.data 
        }))
      }
      
      router.refresh()
      onClose()
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response) {
        const errorData = err.response.data as
          | { message?: string; error?: string }
          | undefined
        setError(errorData?.message || "Failed to update profile")
      } else {
        setError("An unexpected error occurred")
      }
      console.error(err)
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      setError(null)
      const response = await axiosClient.patch("/api/profile", { imageUrl: "" })
      
      // Update form value and local state immediately so the avatar updates in the UI
      form.setValue("imageUrl", "")
      setCurrentImageUrl(null)
      dropzoneProps.setFiles([])
      
      // Update the profile in modal data immediately so the avatar updates in the UI
      if (data?.profile) {
        data.profile.imageUrl = ""
      }
      
      // Dispatch custom event to notify all components of profile update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profile-updated', { 
          detail: response.data 
        }))
      }
      
      router.refresh()
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response) {
        const errorData = err.response.data as
          | { message?: string; error?: string }
          | undefined
        setError(errorData?.message || "Failed to remove avatar")
      } else {
        setError("An unexpected error occurred")
      }
      console.error(err)
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
    // Note: Form and dropzone reset is handled by useEffect when isModalOpen changes
  }

  if (!profile) {
    return null
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent overlayVariant="account">
        <ModalHeader title="Edit Account" description="Edit your account." />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <div className="flex flex-col items-center gap-4">
                <UserAvatar 
                  src={profile.email} 
                  imageUrl={currentImageUrl || null} 
                  size={80} 
                />
                {currentImageUrl && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Avatar
                  </Button>
                )}
              </div>
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold">
                      Avatar (Optional)
                    </FormLabel>
                    <FormControl>
                      <Dropzone {...dropzoneProps}>
                        <DropzoneEmptyState />
                        <DropzoneContent />
                      </Dropzone>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold">
                      Username
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="Enter username"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>Email:</strong> {profile.email}
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
            <DialogFooter className="px-6 py-4">
              <div className="flex items-center justify-between w-full">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isLoading}
                >
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditAccountModal
