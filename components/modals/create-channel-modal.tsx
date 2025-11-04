"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useParams, useRouter } from "next/navigation"
import { ModalHeader } from "./_modal-header"

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
import { useEffect } from "react"

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Channel name is required",
  }).refine((name) => name !== "general", {
    message: "Channel name cannot be 'general'",
  }),
  type: z.enum(ChannelType),
})

const CreateChannelModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()
  const params = useParams()

  const isModalOpen = isOpen && type === "createChannel"
  const { channelType } = data || {}

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: ChannelType.TEXT,
    },
  })

  useEffect(() => {
    if (channelType) {
      form.setValue("type", channelType)
    } else {
      form.setValue("type", ChannelType.TEXT)
    }
  }, [channelType, form])

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log(values)
    try {
      const url = qs.stringifyUrl({
        url: "/api/channels",
        query: {
          serverId: params?.serverId,
        },
      })
      await axios.post(url, values)

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
        <ModalHeader title="Create a Channel" description="Create a channel to get started." />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold">Channel name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      placeholder="Enter channel name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold">Channel type</FormLabel>
                  <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="capitalize outline-none">
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
            </div>
            <DialogFooter className="px-6 py-4">
              <Button disabled={isLoading} variant="primary">Create Channel</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog >
  )
}

export default CreateChannelModal