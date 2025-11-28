"use client"

import React from "react"
import { Bold, Italic, Quote, EyeOff, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMarkdownFormatting } from "./lexical-markdown-shortcuts"
import { SelectionPosition } from "./lexical-floating-toolbar-plugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection } from "lexical"
import { useState, useEffect, useRef } from "react"
import { isValidUrl } from "@/lib/url-validation"

interface LexicalFloatingToolbarProps {
  position: SelectionPosition | null
}

/**
 * Floating formatting toolbar that appears above selected text
 * Provides quick access to formatting options: Bold, Italic, Quote, Spoiler, Link
 */
export function LexicalFloatingToolbar({
  position,
}: LexicalFloatingToolbarProps) {
  const [editor] = useLexicalComposerContext()
  const { applyBold, applyItalic, applyQuote, applySpoiler, applyLink } =
    useMarkdownFormatting()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)
  const [selectedTextForLink, setSelectedTextForLink] = useState<string>("")
  const [linkUrl, setLinkUrl] = useState<string>("")
  const [linkError, setLinkError] = useState<string>("")
  const [preservedPosition, setPreservedPosition] = useState<SelectionPosition | null>(null)
  const linkButtonRef = useRef<HTMLButtonElement>(null)

  // Preserve position when popover opens
  useEffect(() => {
    if (position && !isLinkPopoverOpen) {
      setPreservedPosition(position)
    }
  }, [position, isLinkPopoverOpen])

  // Check current formatting state
  useEffect(() => {
    const currentPosition = position || preservedPosition
    if (!currentPosition) return

    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        setIsBold(selection.hasFormat("bold"))
        setIsItalic(selection.hasFormat("italic"))
      }
    })
  }, [editor, position, preservedPosition])

  // Use preserved position if popover is open, otherwise use current position
  const toolbarPosition = isLinkPopoverOpen ? preservedPosition : position

  if (!toolbarPosition) {
    return null
  }

  const handleBold = (e: React.MouseEvent) => {
    e.preventDefault()
    applyBold()
  }

  const handleItalic = (e: React.MouseEvent) => {
    e.preventDefault()
    applyItalic()
  }

  const handleQuote = (e: React.MouseEvent) => {
    e.preventDefault()
    applyQuote()
  }

  const handleSpoiler = (e: React.MouseEvent) => {
    e.preventDefault()
    applySpoiler()
  }

  const handleLink = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Preserve current position before opening popover
    if (position) {
      setPreservedPosition(position)
    }
    
    // Capture selected text synchronously before selection might be lost
    let capturedText = ""
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        capturedText = selection.getTextContent()
      }
    })
    
    if (capturedText.trim()) {
      // Text is selected: open popover
      setSelectedTextForLink(capturedText)
      setLinkUrl("")
      setLinkError("")
      setIsLinkPopoverOpen(true)
    } else {
      // No text selected: insert template
      applyLink()
    }
  }

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear previous error
    setLinkError("")
    
    // Validate URL
    const trimmedUrl = linkUrl.trim()
    if (!trimmedUrl) {
      setLinkError("URL is required")
      return
    }
    
    if (!isValidUrl(trimmedUrl)) {
      setLinkError("Please enter a valid URL (e.g., https://example.com)")
      return
    }
    
    // Apply link with URL
    applyLink(trimmedUrl)
    
    // Close popover and reset state
    setIsLinkPopoverOpen(false)
    setLinkUrl("")
    setSelectedTextForLink("")
    setLinkError("")
  }

  const handleLinkCancel = () => {
    setIsLinkPopoverOpen(false)
    setLinkUrl("")
    setSelectedTextForLink("")
    setLinkError("")
  }

  return (
    <div
      className="fixed z-50 bg-popover border border-border rounded-md shadow-lg p-1 flex items-center gap-1"
      style={{
        left: `${toolbarPosition.x}px`,
        top: `${toolbarPosition.y - 48}px`,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => {
        // Prevent toolbar from stealing focus
        e.preventDefault()
      }}
    >
      <Button
        type="button"
        variant={isBold ? "secondary" : "ghost"}
        size="icon-sm"
        onMouseDown={handleBold}
        className="h-8 w-8 rounded-sm"
        title="Bold (**text**)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={isItalic ? "secondary" : "ghost"}
        size="icon-sm"
        onMouseDown={handleItalic}
        className="h-8 w-8 rounded-sm"
        title="Italic (*text*)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onMouseDown={handleQuote}
        className="h-8 w-8 rounded-sm"
        title="Quote (> text)"
      >
        <Quote className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onMouseDown={handleSpoiler}
        className="h-8 w-8 rounded-sm"
        title="Spoiler (||text||)"
      >
        <EyeOff className="h-4 w-4" />
      </Button>
      <Popover 
        open={isLinkPopoverOpen} 
        modal={false}
        onOpenChange={(open) => {
          setIsLinkPopoverOpen(open)
          if (!open) {
            // Reset state when popover closes
            setLinkUrl("")
            setSelectedTextForLink("")
            setLinkError("")
            setPreservedPosition(null)
          }
        }}
      >
        <PopoverAnchor asChild>
          <Button
            ref={linkButtonRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseDown={handleLink}
            className="h-8 w-8 rounded-sm"
            title="Link ([text](url))"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </PopoverAnchor>
        <PopoverContent 
          side="top" 
          align="center" 
          sideOffset={8}
          className="w-80 z-[60]"
          onOpenAutoFocus={(e) => {
            // Focus the input when popover opens
            e.preventDefault()
            if (e.currentTarget) {
              const input = e.currentTarget.querySelector("input")
              if (input) {
                setTimeout(() => input.focus(), 0)
              }
            }
          }}
          onInteractOutside={(e) => {
            // Prevent closing when clicking inside the toolbar or editor
            const target = e.target as Node
            const editorElement = editor.getRootElement()
            if (
              editorElement?.contains(target) ||
              e.currentTarget.parentElement?.contains(target)
            ) {
              e.preventDefault()
            }
          }}
        >
          <form onSubmit={handleLinkSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-url">Enter URL</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value)
                  // Clear error when user types
                  if (linkError) {
                    setLinkError("")
                  }
                }}
                aria-invalid={!!linkError}
                aria-describedby={linkError ? "link-error" : undefined}
              />
              {linkError && (
                <p id="link-error" className="text-sm text-destructive">
                  {linkError}
                </p>
              )}
              {selectedTextForLink && (
                <p className="text-xs text-muted-foreground">
                  Link text: <span className="font-medium">{selectedTextForLink}</span>
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleLinkCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
              >
                Add Link
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  )
}

