"use client"

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $getSelection,
  $isRangeSelection,
  $createTextNode,
  $insertNodes,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from "lexical"
import React, { useEffect, useState, useCallback, useRef } from "react"
import { $createMentionNode } from "@/lib/lexical/nodes"
import { $isMentionNode } from "@/lib/lexical/nodes"
import { isValidUrl, isValidUuid } from "@/lib/url-validation"
import Image from "next/image"

interface MentionOption {
  id: string
  name: string
  type: "user" | "channel"
  imageUrl?: string
}

interface MentionsPluginProps {
  serverId?: string
  type: "channel" | "conversation"
}

/**
 * MentionsPlugin - Lexical plugin for @user and #channel mentions
 * 
 * Features:
 * - Auto-complete for user and channel mentions
 * - Keyboard navigation (arrow keys, enter, tab, escape)
 * - Validates serverId before making API calls
 * - Sanitizes image URLs from API responses
 * 
 * Security:
 * - Validates serverId is a valid UUID before API calls
 * - Sanitizes image URLs to prevent XSS
 * - Handles rate limiting gracefully
 * 
 * @param serverId - UUID of the server (validated before use)
 * @param type - "channel" for server channels, "conversation" for DMs
 */
export function MentionsPlugin({ serverId, type }: MentionsPluginProps): React.ReactElement | null {
  const [editor] = useLexicalComposerContext()
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<MentionOption[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerPosition, setTriggerPosition] = useState<{ x: number; y: number } | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const fetchMentions = useCallback(
    async (searchQuery: string, mentionTypeParam: "user" | "channel" | null) => {
      // Validate serverId before making API calls
      if (!serverId || type !== "channel" || !isValidUuid(serverId)) {
        setOptions([])
        return
      }

      try {
        const params = new URLSearchParams({
          serverId,
          query: searchQuery,
          ...(mentionTypeParam ? { type: mentionTypeParam } : {}),
        })

        const response = await fetch(`/api/mentions?${params.toString()}`)

        if (!response.ok) {
          // Handle rate limiting
          if (response.status === 429) {
            console.warn("[MENTIONS_FETCH_ERROR] Rate limited")
            setOptions([])
            return
          }
          // Handle other errors
          console.error("[MENTIONS_FETCH_ERROR] HTTP error:", response.status)
          setOptions([])
          return
        }

        const data = (await response.json()) as MentionOption[]
        // Validate and sanitize image URLs
        const sanitizedData = data.map((option) => ({
          ...option,
          imageUrl: option.imageUrl && isValidUrl(option.imageUrl) ? option.imageUrl : undefined,
        }))
        setOptions(sanitizedData)
      } catch (error) {
        console.error("[MENTIONS_FETCH_ERROR]", error)
        setOptions([])
      }
    },
    [serverId, type],
  )

  const insertMention = useCallback(
    (option: MentionOption) => {
      editor.update(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          return
        }

        const anchorNode = selection.anchor.getNode()
        const textContent = anchorNode.getTextContent()
        const offset = selection.anchor.offset

        // Find the trigger position
        let triggerPos = offset - 1
        let triggerChar = ""
        while (triggerPos >= 0) {
          const char = textContent[triggerPos]
          if (char === "@" || char === "#") {
            triggerChar = char
            break
          }
          if (char === " " || char === "\n") {
            break
          }
          triggerPos--
        }

        if (triggerPos < 0 || !triggerChar) {
          return
        }

        // Calculate the range to replace
        const startPos = triggerPos
        const endPos = offset

        // Create mention node
        const mentionNode = $createMentionNode(
          option.name,
          option.type,
          option.id,
          `${triggerChar}${option.name}`,
        )

        // Get the text node and replace the range
        const textNode = anchorNode
        const beforeText = textContent.slice(0, startPos)
        const afterText = textContent.slice(endPos)

        // Split the text node if needed
        if ($isTextNode(textNode)) {
          if (beforeText) {
            textNode.setTextContent(beforeText)
          } else {
            textNode.remove()
          }
        }

        // Insert mention and remaining text
        if (afterText) {
          const afterNode = $createTextNode(afterText)
          $insertNodes([mentionNode, afterNode])
        } else {
          $insertNodes([mentionNode])
        }

        setIsOpen(false)
        setTriggerPosition(null)
      })
    },
    [editor],
  )

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          if (isOpen) {
            setIsOpen(false)
            setTriggerPosition(null)
          }
          return
        }

        const anchorNode = selection.anchor.getNode()
        const textContent = anchorNode.getTextContent()
        const offset = selection.anchor.offset

        // Check if we're inside a mention node
        let node = anchorNode
        while (node) {
          if ($isMentionNode(node)) {
            if (isOpen) {
              setIsOpen(false)
              setTriggerPosition(null)
            }
            return
          }
          const parent = node.getParent()
          if (!parent) break
          node = parent
        }

        // Look for @ or # trigger
        let triggerPos = offset - 1
        let triggerChar = ""
        while (triggerPos >= 0) {
          const char = textContent[triggerPos]
          if (char === "@" || char === "#") {
            triggerChar = char
            break
          }
          if (char === " " || char === "\n") {
            break
          }
          triggerPos--
        }

        if (triggerPos >= 0 && triggerChar) {
          // Check if there's a space before the trigger (start of mention)
          const charBefore = triggerPos > 0 ? textContent[triggerPos - 1] : " "
          if (charBefore === " " || charBefore === "\n" || triggerPos === 0) {
            const queryText = textContent.slice(triggerPos + 1, offset)
            setIsOpen(true)
            setSelectedIndex(0)

            // Calculate position for menu
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
              const domRange = selection.getRangeAt(0)
              const rect = domRange.getBoundingClientRect()
              setTriggerPosition({
                x: rect.left,
                y: rect.top
              })
            }

            // Fetch mentions
            void fetchMentions(queryText, triggerChar === "@" ? "user" : "channel")
          } else {
            if (isOpen) {
              setIsOpen(false)
              setTriggerPosition(null)
            }
          }
        } else {
          if (isOpen) {
            setIsOpen(false)
            setTriggerPosition(null)
          }
        }
      })
    })
  }, [editor, isOpen, fetchMentions])

  // Handle keyboard navigation
  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        if (isOpen && options.length > 0) {
          event?.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % options.length)
          return true
        }
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, isOpen, options.length])

  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        if (isOpen && options.length > 0) {
          event?.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + options.length) % options.length)
          return true
        }
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, isOpen, options.length])

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (isOpen && options.length > 0 && options[selectedIndex]) {
          event?.preventDefault()
          insertMention(options[selectedIndex])
          return true
        }
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, isOpen, options, selectedIndex, insertMention])

  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        if (isOpen && options.length > 0 && options[selectedIndex]) {
          event?.preventDefault()
          insertMention(options[selectedIndex])
          return true
        }
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, isOpen, options, selectedIndex, insertMention])

  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (isOpen) {
          setIsOpen(false)
          setTriggerPosition(null)
          return true
        }
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, isOpen])

  // Calculate menu position after render to avoid viewport overflow
  useEffect(() => {
    if (!isOpen || !triggerPosition || !menuRef.current) {
      setMenuPosition(null)
      return
    }

    const menuElement = menuRef.current
    const viewportHeight = window.innerHeight
    const offsetY = 20 // Space between cursor and menu
    const maxMenuHeight = 256 // max-h-64 = 256px
    const minMargin = 8 // Minimum margin from viewport edges

    // Calculate space available
    const spaceBelow = viewportHeight - triggerPosition.y - offsetY

    // Try to position below first
    let finalY = triggerPosition.y + offsetY
    let shouldPositionAbove = false

    // If not enough space below, position above
    if (spaceBelow < Math.min(maxMenuHeight, options.length * 48)) {
      shouldPositionAbove = true
      finalY = triggerPosition.y - offsetY - maxMenuHeight
    }

    // Measure actual menu height after render
    requestAnimationFrame(() => {
      const actualHeight = menuElement.offsetHeight || maxMenuHeight

      if (shouldPositionAbove) {
        // Position above cursor
        const topPosition = triggerPosition.y - actualHeight - offsetY
        finalY = Math.max(minMargin, topPosition)
      } else {
        // Position below cursor, but ensure it doesn't overflow
        const bottomPosition = triggerPosition.y + offsetY
        const menuBottom = bottomPosition + actualHeight

        if (menuBottom > viewportHeight - minMargin) {
          // Would overflow, position above instead
          finalY = Math.max(minMargin, triggerPosition.y - actualHeight - offsetY)
        } else {
          finalY = bottomPosition
        }
      }

      // Ensure menu stays within viewport bounds
      finalY = Math.max(minMargin, Math.min(finalY, viewportHeight - actualHeight - minMargin))

      setMenuPosition({ x: triggerPosition.x, y: finalY })
    })
  }, [isOpen, triggerPosition, options.length])

  if (!isOpen || !triggerPosition || options.length === 0) {
    return null
  }

  // Use calculated position if available, otherwise position below (will be adjusted by useEffect)
  const displayPosition = menuPosition || {
    x: triggerPosition.x,
    y: triggerPosition.y + 20
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto"
      style={{
        left: `${displayPosition.x}px`,
        top: `${displayPosition.y}px`,
      }}
    >
      {options.map((option, index) => (
        <div
          key={option.id}
          className={`
            px-3 py-2 cursor-pointer flex items-center gap-2
            ${index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"}
          `}
          onClick={() => insertMention(option)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {option.type === "user" && option.imageUrl && isValidUrl(option.imageUrl) && (
            <Image
              src={option.imageUrl}
              alt={option.name}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full"
            />
          )}
          {option.type === "channel" && (
            <span className="text-muted-foreground">#</span>
          )}
          <span>{option.name}</span>
        </div>
      ))}
    </div>
  )
}

