"use client"

import { useForm } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "@/lib/utils"
import { useRef, useState, useCallback } from "react"

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, BarChart3 } from "lucide-react"
import { useModal } from "@/hooks/use-modal-store"
import { EmojiPicker } from "@/components/emoji-picker"
import { Member, Profile } from "@prisma/client"
import { useSendMessage } from "@/hooks/use-send-message"
import { FormattingToolbar } from "@/components/chat/formatting-toolbar"

interface ChatInputProps {
  apiUrl: string
  query: { channelId?: string, serverId?: string, conversationId?: string }
  name: string
  type: "channel" | "conversation"
  chatId: string
  currentMember: Member & { profile: Profile }
}

const formSchema = z.object({
  content: z.string().min(1),
})

export const ChatInput = ({ apiUrl, query, name, type, chatId, currentMember }: ChatInputProps) => {
  const { onOpen } = useModal()
  const queryKey = `chat:${chatId}`
  const { sendMessage, isSending } = useSendMessage({
    apiUrl,
    query,
    queryKey,
    currentMember,
    type,
  })

  const inputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [toolbarOpen, setToolbarOpen] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
    },
  })

  const isLoading = form.formState.isSubmitting || isSending

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const content = values.content.trim()
      if (!content) {
        return
      }

      await sendMessage(content)
      form.reset()
      setToolbarOpen(false)
      setIsFocused(false)
    } catch (error) {
      console.error(error)
    }
  }

  const insertMarkdown = useCallback((markdown: string) => {
    const input = inputRef.current
    if (!input) return

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const currentValue = form.getValues("content")
    const selectedText = currentValue.substring(start, end)

    let newValue: string
    let newCursorPos: number

    // Handle different markdown insertion patterns
    if (markdown === "**" || markdown === "*" || markdown === "||") {
      // Wrap selected text or insert markers
      if (selectedText) {
        newValue =
          currentValue.substring(0, start) +
          `${markdown}${selectedText}${markdown}` +
          currentValue.substring(end)
        newCursorPos = start + markdown.length + selectedText.length + markdown.length
      } else {
        newValue =
          currentValue.substring(0, start) +
          `${markdown}${markdown}` +
          currentValue.substring(end)
        newCursorPos = start + markdown.length
      }
    } else if (markdown === "> ") {
      // Quote: insert at start of line
      const lineStart = currentValue.lastIndexOf("\n", start - 1) + 1
      const lineEnd = currentValue.indexOf("\n", end)
      const lineEndPos = lineEnd === -1 ? currentValue.length : lineEnd
      const line = currentValue.substring(lineStart, lineEndPos)

      if (line.startsWith("> ")) {
        // Remove quote if already quoted
        newValue =
          currentValue.substring(0, lineStart) +
          line.substring(2) +
          currentValue.substring(lineEndPos)
        newCursorPos = start - 2
      } else {
        // Add quote
        newValue =
          currentValue.substring(0, lineStart) +
          "> " +
          line +
          currentValue.substring(lineEndPos)
        newCursorPos = start + 2
      }
    } else if (markdown === "[text](url)") {
      // Link: replace selected text or insert template
      if (selectedText) {
        newValue =
          currentValue.substring(0, start) +
          `[${selectedText}](url)` +
          currentValue.substring(end)
        newCursorPos = start + selectedText.length + 3 // Position after selected text, before "url"
      } else {
        newValue =
          currentValue.substring(0, start) +
          "[text](url)" +
          currentValue.substring(end)
        newCursorPos = start + 1 // Position after "["
      }
    } else {
      // Default: just insert
      newValue =
        currentValue.substring(0, start) +
        markdown +
        currentValue.substring(end)
      newCursorPos = start + markdown.length
    }

    form.setValue("content", newValue)

    // Restore cursor position after React updates
    setTimeout(() => {
      if (input) {
        input.focus()
        input.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [form])

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

                <FormattingToolbar
                  onFormat={insertMarkdown}
                  open={toolbarOpen && isFocused}
                  onOpenChange={setToolbarOpen}
                >
                  <div className="absolute top-5.75 left-14 z-10">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-8 w-8 rounded-full"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        inputRef.current?.focus()
                      }}
                    >
                      <span className="text-xs font-bold">Aa</span>
                    </Button>
                  </div>
                </FormattingToolbar>

                <Input
                  disabled={isLoading}
                  className={cn(
                    "px-14 py-6 bg-muted/50 font-medium",
                    "text-foreground placeholder:text-muted-foreground/70",
                    type === "channel" && "pl-20"
                  )}
                  placeholder={`Message ${type === "conversation" ? name : "#" + name}`}
                  {...field}
                  ref={(e) => {
                    field.ref(e)
                    inputRef.current = e
                  }}
                  onFocus={() => {
                    setIsFocused(true)
                    setToolbarOpen(true)
                  }}
                  onBlur={(e) => {
                    // Delay to allow toolbar button clicks
                    setTimeout(() => {
                      if (!e.currentTarget.contains(document.activeElement)) {
                        setIsFocused(false)
                        setToolbarOpen(false)
                      }
                    }, 200)
                  }}
                />

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