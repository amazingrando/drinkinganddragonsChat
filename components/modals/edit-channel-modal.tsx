"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useRouter } from "next/navigation"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useModal } from "@/hooks/use-modal-store"
import { ChannelType } from "@prisma/client"
import qs from "query-string"
import { useEffect, useState } from "react"
import { ModalHeader } from "./_modal-header"

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Channel name is required",
  }).refine((name) => name !== "general", {
    message: "Channel name cannot be 'general'",
  }),
  type: z.enum(ChannelType),
  categoryId: z.string().nullable().optional(),
})

const EditChannelModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])

  const isModalOpen = isOpen && type === "editChannel"
  const { channel, server } = data || {}

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: channel?.type ?? ChannelType.TEXT,
      categoryId: null,
    },
  })

  useEffect(() => {
    if (isModalOpen && server?.id) {
      const fetchCategories = async () => {
        try {
          const response = await axios.get(`/api/servers/${server.id}/categories`)
          setCategories(response.data)
        } catch (error) {
          console.error("Failed to fetch categories", error)
        }
      }
      void fetchCategories()
    }
  }, [isModalOpen, server?.id])

  useEffect(() => {
    if (channel) {
      if (channel.name) {
        form.setValue("name", channel.name)
      }
      if (channel.type) {
        form.setValue("type", channel.type)
      }
      if ("categoryId" in channel) {
        form.setValue("categoryId", (channel.categoryId as string | null) || null)
      }
    }
  }, [channel, form])

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = qs.stringifyUrl({
        url: `/api/channels/${channel?.id}`,
        query: {
          serverId: server?.id,
        },
      })
      const payload = {
        name: values.name,
        type: values.type,
      }
      await axios.patch(url, payload)

      // Update category separately if changed
      if (values.categoryId !== (channel?.categoryId || null)) {
        await axios.patch(
          `/api/channels/${channel?.id}/category?serverId=${server?.id}`,
          { categoryId: values.categoryId || null }
        )
      }

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
        <ModalHeader title="Edit Channel" description="Edit your channel." />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold">Channel name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      className=""
                      placeholder="Enter channel name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-zinc-500 dark:text-white">Channel type</FormLabel>
                  <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="">
                        <SelectValue placeholder="Select channel type" />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      {Object.values(ChannelType).map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">
                          {type.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {categories.length > 0 && (
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold">Category (optional)</FormLabel>
                    <Select
                      disabled={isLoading}
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger className="outline-none">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Ungrouped</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>
            <DialogFooter className="px-6 py-4">
              <Button disabled={isLoading} variant="primary">Save</Button>
            </DialogFooter>

          </form>
        </Form>
      </DialogContent>
    </Dialog >
  )
}

export default EditChannelModal