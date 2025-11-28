"use client"

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection } from "lexical"
import { $isMentionNode } from "@/lib/lexical/nodes"
import { $isLinkNode } from "@lexical/link"
import { useEffect, useCallback } from "react"

export interface SelectionPosition {
  x: number
  y: number
  width: number
}

interface FloatingToolbarPluginProps {
  onSelectionChange: (position: SelectionPosition | null) => void
}

/**
 * Plugin that tracks text selection and calculates DOM position for floating toolbar
 */
export function FloatingToolbarPlugin({
  onSelectionChange,
}: FloatingToolbarPluginProps) {
  const [editor] = useLexicalComposerContext()

  const updateSelectionPosition = useCallback(() => {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        onSelectionChange(null)
        return
      }

      const range = selection.getRangeAt(0)
      if (range.collapsed) {
        onSelectionChange(null)
        return
      }

      // Check if selection is within the editor
      const editorElement = editor.getRootElement()
      if (!editorElement || !editorElement.contains(range.commonAncestorContainer)) {
        onSelectionChange(null)
        return
      }

      // Check if selection is inside a mention or link node
      editor.getEditorState().read(() => {
        const lexicalSelection = $getSelection()
        if (!$isRangeSelection(lexicalSelection)) {
          onSelectionChange(null)
          return
        }

        const anchorNode = lexicalSelection.anchor.getNode()
        let node = anchorNode
        let isInsideSpecialNode = false

        while (node) {
          if ($isMentionNode(node) || $isLinkNode(node)) {
            isInsideSpecialNode = true
            break
          }
          const parent = node.getParent()
          if (!parent) break
          node = parent
        }

        if (isInsideSpecialNode) {
          onSelectionChange(null)
          return
        }

        // Get bounding rect of selection
        const rect = range.getBoundingClientRect()
        const position: SelectionPosition = {
          x: rect.left + rect.width / 2, // Center of selection
          y: rect.top, // Top of selection
          width: rect.width,
        }

        onSelectionChange(position)
      })
    }, 0)
  }, [editor, onSelectionChange])

  useEffect(() => {
    // Listen to editor updates to detect selection changes
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const selectedText = selection.getTextContent()
          // Only show toolbar if there's actual text selected
          if (selectedText.trim().length > 0) {
            updateSelectionPosition()
          } else {
            onSelectionChange(null)
          }
        } else {
          onSelectionChange(null)
        }
      })
    })
  }, [editor, updateSelectionPosition, onSelectionChange])

  useEffect(() => {
    // Listen to mouseup events to catch selection changes
    const handleMouseUp = () => {
      updateSelectionPosition()
    }

    // Listen to click events to hide toolbar when clicking outside
    const handleClick = (event: MouseEvent) => {
      const editorElement = editor.getRootElement()
      if (editorElement && !editorElement.contains(event.target as Node)) {
        onSelectionChange(null)
      }
    }

    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("click", handleClick)

    return () => {
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("click", handleClick)
    }
  }, [editor, updateSelectionPosition, onSelectionChange])

  // Handle scroll events to reposition toolbar
  useEffect(() => {
    const handleScroll = () => {
      updateSelectionPosition()
    }

    const editorElement = editor.getRootElement()
    if (editorElement) {
      editorElement.addEventListener("scroll", handleScroll)
      window.addEventListener("scroll", handleScroll, true)

      return () => {
        editorElement.removeEventListener("scroll", handleScroll)
        window.removeEventListener("scroll", handleScroll, true)
      }
    }
  }, [editor, updateSelectionPosition])

  return null
}

