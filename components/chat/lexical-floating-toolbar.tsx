"use client"

import React from "react"
import { Bold, Italic, Quote, EyeOff, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMarkdownFormatting } from "./lexical-markdown-shortcuts"
import { SelectionPosition } from "./lexical-floating-toolbar-plugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection } from "lexical"
import { useState, useEffect } from "react"

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

  // Check current formatting state
  useEffect(() => {
    if (!position) return

    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        setIsBold(selection.hasFormat("bold"))
        setIsItalic(selection.hasFormat("italic"))
      }
    })
  }, [editor, position])

  if (!position) {
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
    applyLink()
  }

  return (
    <div
      className="fixed z-50 bg-popover border border-border rounded-md shadow-lg p-1 flex items-center gap-1"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 48}px`,
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
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onMouseDown={handleLink}
        className="h-8 w-8 rounded-sm"
        title="Link ([text](url))"
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}

