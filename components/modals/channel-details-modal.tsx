"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

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
import { useModal } from "@/hooks/use-modal-store"
import { MemberRole } from "@prisma/client"
import qs from "query-string"
import { ModalHeader } from "./_modal-header"

const formSchema = z.object({
  description: z.string().max(500, "Description too long").optional(),
})

const ChannelDetailsModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()

  const isModalOpen = isOpen && type === "channelDetails"
  const { channel, server, currentMemberRole } = data || {}

  const isAdmin = currentMemberRole === MemberRole.ADMIN
  const isModerator = currentMemberRole === MemberRole.MODERATOR
  const canEdit = isAdmin || isModerator

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
    },
  })

  useEffect(() => {
    if (channel) {
      form.setValue("description", channel.description || "")
    }
  }, [channel, form])

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!canEdit) {
      return
    }

    try {
      const url = qs.stringifyUrl({
        url: `/api/channels/${channel?.id}`,
        query: {
          serverId: server?.id,
        },
      })
      await axios.patch(url, { description: values.description || null })

      form.reset()
      router.refresh()
      onClose()
    } catch (error) {
      console.error(error)
    }
  }

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent>
        <ModalHeader title="Channel Details" description="View and manage channel information." />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <FormItem>
                <FormLabel className="uppercase text-xs font-bold">Channel name</FormLabel>
                <FormControl>
                  <Input
                    disabled
                    value={channel?.name || ""}
                    className="bg-muted"
                  />
                </FormControl>
              </FormItem>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold">Description</FormLabel>
                    <FormControl>
                      <textarea
                        disabled={isLoading || !canEdit}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder={canEdit ? "Enter channel description" : "No description"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {canEdit && (
              <DialogFooter className="px-6 py-4">
                <Button disabled={isLoading} variant="primary">Save</Button>
              </DialogFooter>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default ChannelDetailsModal

