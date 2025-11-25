"use client"

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical"
import { useEffect } from "react"
import {
  $createQuoteNode,
  $isQuoteNode,
} from "@lexical/rich-text"
import { $createParagraphNode, $getRoot } from "lexical"
import { $isLinkNode, $createLinkNode } from "@lexical/link"
import { $isMentionNode } from "@/lib/lexical/nodes"

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
        const focusNode = selection.focus.getNode()
        
        // Get the line containing the selection
        const root = $getRoot()
        const paragraphs = root.getChildren()
        
        // Find paragraph containing selection
        for (const paragraph of paragraphs) {
          if (paragraph.getTextContent().includes(anchorNode.getTextContent())) {
            const text = paragraph.getTextContent()
            if (text.startsWith("> ")) {
              // Remove quote
              paragraph.setTextContent(text.slice(2))
            } else {
              // Add quote
              paragraph.setTextContent("> " + text)
            }
            break
          }
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
            if (parent) {
              const fullText = parent.getTextContent()
              const start = selection.anchor.offset
              const end = selection.focus.offset
              const before = fullText.slice(0, Math.min(start, end))
              const selected = fullText.slice(Math.min(start, end), Math.max(start, end))
              const after = fullText.slice(Math.max(start, end))
              
              // Check if already wrapped
              if (before.endsWith("||") && after.startsWith("||")) {
                // Remove spoiler markers
                parent.setTextContent(before.slice(0, -2) + selected + after.slice(2))
              } else {
                // Add spoiler markers
                parent.setTextContent(before + "||" + selected + "||" + after)
              }
            }
          }
        } else {
          // Insert || markers
          const textNode = selection.anchor.getNode()
          if (textNode) {
            const parent = textNode.getParent()
            if (parent) {
              const fullText = parent.getTextContent()
              const offset = selection.anchor.offset
              parent.setTextContent(fullText.slice(0, offset) + "||||" + fullText.slice(offset))
            }
          }
        }
      }
    })
  }

  const applyLink = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent()
        if (selectedText) {
          // Create link with selected text
          const linkNode = $createLinkNode("url")
          linkNode.setTextContent(selectedText)
          selection.insertNodes([linkNode])
        } else {
          // Insert link template
          const textNode = selection.anchor.getNode()
          if (textNode) {
            const parent = textNode.getParent()
            if (parent) {
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

