"use client"

import React from "react"
import { Bold, Italic, Quote, EyeOff, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface FormattingToolbarProps {
  onFormat: (markdown: string) => void
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  selectionPosition?: { x: number; y: number; width: number } | null
}

/**
 * Formatting toolbar popover for markdown formatting
 * Provides buttons to insert markdown syntax at cursor position
 * Can be positioned above selected text using anchorElement prop
 */
export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onFormat,
  children,
  open,
  onOpenChange,
  selectionPosition,
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

  const anchorRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (selectionPosition && anchorRef.current) {
      const anchor = anchorRef.current
      // Position anchor at the center of the selection
      anchor.style.position = "fixed"
      anchor.style.left = `${selectionPosition.x + selectionPosition.width / 2}px`
      anchor.style.top = `${selectionPosition.y}px`
      anchor.style.width = "1px"
      anchor.style.height = "1px"
      anchor.style.pointerEvents = "none"
      anchor.style.zIndex = "50"
    }
  }, [selectionPosition])

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {selectionPosition ? (
        <PopoverAnchor asChild>
          <div ref={anchorRef} />
        </PopoverAnchor>
      ) : (
        <PopoverTrigger asChild>{children}</PopoverTrigger>
      )}
      <PopoverContent
        className="w-auto p-2"
        side="top"
        align="center"
        sideOffset={8}
      >
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseDown={(e) => {
              e.preventDefault()
              handleBold()
            }}
            className="h-8 w-8"
            title="Bold (**text**)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseDown={(e) => {
              e.preventDefault()
              handleItalic()
            }}
            className="h-8 w-8"
            title="Italic (*text*)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseDown={(e) => {
              e.preventDefault()
              handleQuote()
            }}
            className="h-8 w-8"
            title="Quote (> text)"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseDown={(e) => {
              e.preventDefault()
              handleSpoiler()
            }}
            className="h-8 w-8"
            title="Spoiler (||text||)"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseDown={(e) => {
              e.preventDefault()
              handleLink()
            }}
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

