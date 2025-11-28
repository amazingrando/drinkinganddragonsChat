"use client"

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical"
import { useEffect } from "react"
import {
  $createQuoteNode,
  $isQuoteNode,
} from "@lexical/rich-text"
import { $createParagraphNode, $getRoot, $createTextNode, $isParagraphNode, $isTextNode } from "lexical"
import { $isLinkNode, $createLinkNode } from "@lexical/link"
import { $isMentionNode } from "@/lib/lexical/nodes"
import { isValidUrl } from "@/lib/url-validation"

/**
 * Plugin that handles markdown shortcuts for formatting
 * Supports: **bold**, *italic*, > quote, ||spoiler||, [text](url)
 */
export function MarkdownShortcutsPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          return
        }

        const anchorNode = selection.anchor.getNode()
        const textContent = anchorNode.getTextContent()
        const offset = selection.anchor.offset

        // Don't process if we're inside a mention, link, or quote
        let node = anchorNode
        while (node) {
          if ($isMentionNode(node) || $isLinkNode(node) || $isQuoteNode(node)) {
            return
          }
          const parent = node.getParent()
          if (!parent) break
          node = parent
        }

        // Handle bold **text**
        if (textContent.slice(offset - 2, offset) === "**" && textContent.slice(offset - 3, offset - 2) !== "*") {
          const textBefore = textContent.slice(0, offset - 2)
          const textAfter = textContent.slice(offset)
          const boldMatch = textBefore.match(/\*\*([^*]+)\*\*$/)

          if (boldMatch && boldMatch[1]) {
            // Already has matching **, just apply formatting
            return
          }
        }

        // Handle italic *text* (but not **text**)
        if (textContent.slice(offset - 1, offset) === "*" && textContent.slice(offset - 2, offset - 1) !== "*") {
          const textBefore = textContent.slice(0, offset - 1)
          const textAfter = textContent.slice(offset)
          const italicMatch = textBefore.match(/(?:^|[^*])\*([^*\n]+)\*$/)

          if (italicMatch && italicMatch[1]) {
            // Already has matching *, just apply formatting
            return
          }
        }

        // Handle spoiler ||text||
        if (textContent.slice(offset - 2, offset) === "||") {
          const textBefore = textContent.slice(0, offset - 2)
          const textAfter = textContent.slice(offset)
          const spoilerMatch = textBefore.match(/\|\|([^|]+)\|\|$/)

          if (spoilerMatch && spoilerMatch[1]) {
            // Already has matching ||, just apply formatting
            return
          }
        }

        // Handle quote > at start of line
        if (textContent.slice(offset - 2, offset) === "> " || (offset === 2 && textContent.slice(0, 2) === "> ")) {
          // Quote handling is done via toolbar, not auto-conversion
          return
        }
      })
    })
  }, [editor])

  return null
}

/**
 * Helper function to apply markdown formatting via toolbar
 */
export function useMarkdownFormatting() {
  const [editor] = useLexicalComposerContext()

  const applyBold = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")
      }
    })
  }

  const applyItalic = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")
      }
    })
  }

  const applyQuote = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode()

        // Find the paragraph containing the selection
        let paragraph = anchorNode
        while (paragraph && !$isParagraphNode(paragraph)) {
          const parent = paragraph.getParent()
          if (!parent) break
          paragraph = parent
        }

        if (paragraph && $isParagraphNode(paragraph)) {
          const text = paragraph.getTextContent()
          const newText = text.startsWith("> ") ? text.slice(2) : "> " + text

          // Clear paragraph and insert new text node
          paragraph.clear()
          const textNode = $createTextNode(newText)
          paragraph.append(textNode)
        }
      } else {
        // Insert quote at cursor
        const quoteNode = $createQuoteNode()
        const paragraph = $createParagraphNode()
        quoteNode.append(paragraph)
        const root = $getRoot()
        root.append(quoteNode)
      }
    })
  }

  const applySpoiler = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent()
        if (selectedText) {
          // Wrap selected text with ||
          const textNode = selection.anchor.getNode()
          if (textNode) {
            const parent = textNode.getParent()
            if (parent && $isParagraphNode(parent)) {
              const fullText = parent.getTextContent()
              const start = selection.anchor.offset
              const end = selection.focus.offset
              const before = fullText.slice(0, Math.min(start, end))
              const selected = fullText.slice(Math.min(start, end), Math.max(start, end))
              const after = fullText.slice(Math.max(start, end))

              // Check if already wrapped
              const newText = (before.endsWith("||") && after.startsWith("||"))
                ? before.slice(0, -2) + selected + after.slice(2)
                : before + "||" + selected + "||" + after

              // Replace paragraph content
              parent.clear()
              const newTextNode = $createTextNode(newText)
              parent.append(newTextNode)
            } else if (parent && $isTextNode(parent)) {
              // If parent is a text node, use setTextContent directly
              const fullText = parent.getTextContent()
              const start = selection.anchor.offset
              const end = selection.focus.offset
              const before = fullText.slice(0, Math.min(start, end))
              const selected = fullText.slice(Math.min(start, end), Math.max(start, end))
              const after = fullText.slice(Math.max(start, end))

              const newText = (before.endsWith("||") && after.startsWith("||"))
                ? before.slice(0, -2) + selected + after.slice(2)
                : before + "||" + selected + "||" + after

              parent.setTextContent(newText)
            }
          }
        } else {
          // Insert || markers
          const textNode = selection.anchor.getNode()
          if (textNode) {
            const parent = textNode.getParent()
            if (parent && $isParagraphNode(parent)) {
              const fullText = parent.getTextContent()
              const offset = selection.anchor.offset
              const newText = fullText.slice(0, offset) + "||||" + fullText.slice(offset)

              // Replace paragraph content
              parent.clear()
              const newTextNode = $createTextNode(newText)
              parent.append(newTextNode)
            } else if (parent && $isTextNode(parent)) {
              const fullText = parent.getTextContent()
              const offset = selection.anchor.offset
              parent.setTextContent(fullText.slice(0, offset) + "||||" + fullText.slice(offset))
            }
          }
        }
      }
    })
  }

  const applyLink = (url?: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent()
        if (selectedText) {
          // If no URL provided, return early (popover will handle URL input)
          if (!url || url.trim() === "") {
            return
          }

          // Validate URL
          const trimmedUrl = url.trim()
          if (!isValidUrl(trimmedUrl)) {
            // Validation error should be handled by the popover component
            return
          }

          // Insert markdown link syntax: [text](url)
          const linkMarkdown = `[${selectedText}](${trimmedUrl})`
          const textNode = selection.anchor.getNode()
          if (textNode) {
            const parent = textNode.getParent()
            if (parent && $isParagraphNode(parent)) {
              const fullText = parent.getTextContent()
              const start = selection.anchor.offset
              const end = selection.focus.offset
              const before = fullText.slice(0, Math.min(start, end))
              const after = fullText.slice(Math.max(start, end))
              const newText = before + linkMarkdown + after

              // Replace paragraph content
              parent.clear()
              const newTextNode = $createTextNode(newText)
              parent.append(newTextNode)

              // Position cursor after the inserted link
              newTextNode.select(
                before.length + linkMarkdown.length,
                before.length + linkMarkdown.length,
              )
            } else if (parent && $isTextNode(parent)) {
              const fullText = parent.getTextContent()
              const start = selection.anchor.offset
              const end = selection.focus.offset
              const before = fullText.slice(0, Math.min(start, end))
              const after = fullText.slice(Math.max(start, end))
              const newText = before + linkMarkdown + after

              parent.setTextContent(newText)

              // Position cursor after the inserted link
              parent.select(before.length + linkMarkdown.length, before.length + linkMarkdown.length)
            }
          }
        } else {
          // Insert link template
          const textNode = selection.anchor.getNode()
          if (textNode) {
            const parent = textNode.getParent()
            if (parent && $isParagraphNode(parent)) {
              const fullText = parent.getTextContent()
              const offset = selection.anchor.offset
              const newText = fullText.slice(0, offset) + "[text](url)" + fullText.slice(offset)

              // Replace paragraph content
              parent.clear()
              const newTextNode = $createTextNode(newText)
              parent.append(newTextNode)
            } else if (parent && $isTextNode(parent)) {
              const fullText = parent.getTextContent()
              const offset = selection.anchor.offset
              parent.setTextContent(fullText.slice(0, offset) + "[text](url)" + fullText.slice(offset))
            }
          }
        }
      }
    })
  }

  return {
    applyBold,
    applyItalic,
    applyQuote,
    applySpoiler,
    applyLink,
  }
}

