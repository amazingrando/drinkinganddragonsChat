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
  const inputElementRef = useRef<HTMLInputElement | null>(null)
  const selectionRangeRef = useRef<{ start: number; end: number } | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number; width: number } | null>(null)
  const [showSelectionHighlight, setShowSelectionHighlight] = useState(false)

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

  const updateSelectionPosition = useCallback(() => {
    const input = inputRef.current
    if (!input) return

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const hasTextSelected = start !== end

    if (hasTextSelected) {
      // Store the selection range
      selectionRangeRef.current = { start, end }
      setShowSelectionHighlight(true)

      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const currentInput = inputRef.current
        if (!currentInput) return

        // Restore selection if it was lost
        if (currentInput.selectionStart === currentInput.selectionEnd && selectionRangeRef.current) {
          currentInput.setSelectionRange(selectionRangeRef.current.start, selectionRangeRef.current.end)
        }

        const currentStart = currentInput.selectionStart || 0
        const currentEnd = currentInput.selectionEnd || 0
        if (currentStart !== start || currentEnd !== end) {
          // Update stored range if it changed
          selectionRangeRef.current = { start: currentStart, end: currentEnd }
        }

        // Calculate selection position for input elements
        const inputRect = currentInput.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(currentInput)
        const textBeforeSelection = currentInput.value.substring(0, currentStart)
        
        // Create a temporary span to measure text width
        const measureSpan = document.createElement("span")
        measureSpan.style.position = "absolute"
        measureSpan.style.visibility = "hidden"
        measureSpan.style.whiteSpace = "pre"
        measureSpan.style.font = computedStyle.font
        measureSpan.style.fontSize = computedStyle.fontSize
        measureSpan.style.fontFamily = computedStyle.fontFamily
        measureSpan.style.fontWeight = computedStyle.fontWeight
        measureSpan.style.letterSpacing = computedStyle.letterSpacing
        measureSpan.style.textTransform = computedStyle.textTransform
        measureSpan.textContent = textBeforeSelection
        document.body.appendChild(measureSpan)
        
        const textWidth = measureSpan.offsetWidth
        
        // Measure selected text width
        const selectedText = currentInput.value.substring(currentStart, currentEnd)
        measureSpan.textContent = selectedText
        const selectedWidth = Math.max(measureSpan.offsetWidth, 1)
        
        document.body.removeChild(measureSpan)

        // Calculate position relative to viewport
        // Account for padding and border
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
        const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0
        const x = inputRect.left + paddingLeft + borderLeft + textWidth
        const y = inputRect.top
        
        setSelectionPosition({ x, y, width: selectedWidth })
      }, 0)
    } else {
      setSelectionPosition(null)
      selectionRangeRef.current = null
      setShowSelectionHighlight(false)
    }
  }, [])

  const insertMarkdown = useCallback((markdown: string) => {
    const input = inputRef.current
    if (!input) return

    // Restore selection if it was lost
    if (selectionRangeRef.current && input.selectionStart === input.selectionEnd) {
      input.setSelectionRange(selectionRangeRef.current.start, selectionRangeRef.current.end)
      input.focus()
    }

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

    // Clear selection highlight
    setShowSelectionHighlight(false)
    selectionRangeRef.current = null

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
                  open={!!selectionPosition}
                  onOpenChange={(open) => {
                    if (!open) {
                      setToolbarOpen(false)
                      setSelectionPosition(null)
                      setShowSelectionHighlight(false)
                      selectionRangeRef.current = null
                    }
                  }}
                  selectionPosition={selectionPosition}
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

                <div className="relative">
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
                      inputElementRef.current = e
                    }}
                  onFocus={() => {
                    setIsFocused(true)
                    // Restore selection if we have one stored
                    if (selectionRangeRef.current) {
                      setTimeout(() => {
                        const input = inputRef.current
                        if (input && selectionRangeRef.current) {
                          input.setSelectionRange(selectionRangeRef.current.start, selectionRangeRef.current.end)
                          // Update position after restoring selection
                          updateSelectionPosition()
                        }
                      }, 0)
                    }
                  }}
                  onSelect={() => {
                    // Only update when there's a selection
                    const input = inputRef.current
                    if (input) {
                      const start = input.selectionStart || 0
                      const end = input.selectionEnd || 0
                      if (start !== end) {
                        setIsFocused(true)
                        updateSelectionPosition()
                      } else {
                        setSelectionPosition(null)
                        setShowSelectionHighlight(false)
                        selectionRangeRef.current = null
                      }
                    }
                  }}
                  onMouseUp={() => {
                    // Update selection on mouse up as well
                    setTimeout(() => {
                      const input = inputRef.current
                      if (input) {
                        const start = input.selectionStart || 0
                        const end = input.selectionEnd || 0
                        if (start !== end) {
                          updateSelectionPosition()
                        }
                      }
                    }, 0)
                  }}
                  onBlur={() => {
                    // Delay to allow toolbar button clicks
                    const input = inputElementRef.current
                    setTimeout(() => {
                      const activeElement = document.activeElement
                      // Check if focus moved to toolbar or is still on input
                      if (input && activeElement !== input && !input.contains(activeElement)) {
                        // Check if focus is on a toolbar button
                        const isToolbarButton = activeElement?.closest('[data-slot="popover-content"]')
                        if (!isToolbarButton) {
                          setIsFocused(false)
                          // Only clear selection if not clicking toolbar
                          setSelectionPosition(null)
                          setShowSelectionHighlight(false)
                          selectionRangeRef.current = null
                        }
                        // If focus is on toolbar, keep the selection stored but don't clear it
                      }
                    }, 150)
                  }}
                  />
                  {showSelectionHighlight && selectionPosition && selectionRangeRef.current && inputRef.current && (
                    <div
                      className="absolute pointer-events-none rounded"
                      style={{
                        left: `${selectionPosition.x - inputRef.current.getBoundingClientRect().left}px`,
                        top: '0px',
                        width: `${selectionPosition.width}px`,
                        height: `${inputRef.current.offsetHeight}px`,
                        backgroundColor: 'rgba(59, 130, 246, 0.25)',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        zIndex: 1,
                      }}
                    />
                  )}
                </div>

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