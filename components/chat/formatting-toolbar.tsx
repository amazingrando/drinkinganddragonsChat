"use client"

import React from "react"
import { Bold, Italic, Quote, EyeOff, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface FormattingToolbarProps {
  onFormat: (markdown: string) => void
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Formatting toolbar popover for markdown formatting
 * Provides buttons to insert markdown syntax at cursor position
 */
export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onFormat,
  children,
  open,
  onOpenChange,
}) => {
  const handleBold = () => {
    onFormat("**")
  }

  const handleItalic = () => {
    onFormat("*")
  }

  const handleQuote = () => {
    onFormat("> ")
  }

  const handleSpoiler = () => {
    onFormat("||")
  }

  const handleLink = () => {
    onFormat("[text](url)")
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        side="top"
        align="start"
        sideOffset={8}
      >
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleBold}
            className="h-8 w-8"
            title="Bold (**text**)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleItalic}
            className="h-8 w-8"
            title="Italic (*text*)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleQuote}
            className="h-8 w-8"
            title="Quote (> text)"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleSpoiler}
            className="h-8 w-8"
            title="Spoiler (||text||)"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleLink}
            className="h-8 w-8"
            title="Link ([text](url))"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

