"use client"

import { useForm } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import qs from "query-string"
import { cn } from "@/lib/utils"

import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, BarChart3, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useModal } from "@/hooks/use-modal-store"
import { EmojiPicker } from "@/components/emoji-picker"

interface ChatInputProps {
  apiUrl: string
  query: { channelId?: string, serverId?: string, conversationId?: string }
  name: string
  type: "channel" | "conversation"
}

const formSchema = z.object({
  content: z.string().min(1),
})

export const ChatInput = ({ apiUrl, query, name, type }: ChatInputProps) => {
  const { onOpen } = useModal()
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
    },
  })

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = qs.stringifyUrl({
        url: apiUrl,
        query: query,
      })
      await axios.post(url, values)
      form.reset();
      router.refresh();
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="border-t border-border px-4 py-4">
        <FormField control={form.control} name="content" render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="relative p-4 pb-6">

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="absolute top-5.75 left-6">
                      <Button variant="primary" size="icon" className="rounded-full bg-mana-600 hover:bg-mana-700" >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent forceMount>
                    <DropdownMenuItem onClick={() => { onOpen("messageFile", { apiUrl, query }); }}>
                      <Plus className="w-4 h-4" />
                      <span>Add a File</span>
                    </DropdownMenuItem>
                    {type === "channel" && (<DropdownMenuItem onClick={() => { onOpen("createPoll", { apiUrl, query }); }}>
                      <BarChart3 className="w-4 h-4 " />
                      <span>Creat a Poll</span>
                    </DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Input disabled={isLoading} className={cn(
                  "px-14 py-6 bg-muted/50 font-medium",
                  "text-foreground placeholder:text-muted-foreground/70",
                  type === "channel" && "pl-14"
                )}
                  placeholder={`Message ${type === "conversation" ? name : "#" + name}`} {...field} />

                <div className="absolute top-7 right-8">
                  <EmojiPicker
                    onChange={(emoji: string) => field.onChange(`${field.value} ${emoji}`)}
                  />
                </div>
              </div>
            </FormControl>
          </FormItem>
        )} />
      </form>
    </Form>
  )
}

export default ChatInput