"use client"

import React, { useState, useMemo } from "react"
import { parseMarkdown, type MarkdownToken } from "@/lib/markdown/parser"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { isValidUrl, isValidUuid } from "@/lib/url-validation"

interface MarkdownRendererProps {
  content: string
  className?: string
  serverId?: string
  currentUserId?: string
  currentUserName?: string
}

/**
 * Renders markdown content as React elements
 * 
 * Supported markdown:
 * - **bold** - Bold text
 * - *italic* - Italic text
 * - > quote - Block quotes
 * - ||spoiler|| - Spoiler text (click to reveal)
 * - [text](url) - Links (validated for safe protocols)
 * - Auto-detected URLs (http://, https://)
 * - @username[id] or @username - User mentions
 * - #channelname[id] or #channelname - Channel mentions
 * 
 * Security:
 * - Validates all URLs before rendering (prevents XSS via javascript:, data:, etc.)
 * - Validates mention IDs are UUIDs before creating links
 * - Renders invalid mentions/URLs as plain text
 * 
 * @param content - Markdown content to render
 * @param className - Optional CSS class
 * @param serverId - Optional server ID for mention links (validated before use)
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  serverId,
  currentUserId,
  currentUserName,
}) => {
  const tokens = useMemo(() => parseMarkdown(content), [content])
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<number>>(
    new Set(),
  )

  const toggleSpoiler = (index: number) => {
    setRevealedSpoilers((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  let spoilerIndex = 0

  // Helper function to calculate the actual text length of a token
  const getTextLength = (token: MarkdownToken): number => {
    if (token.type === "text") {
      return token.content.length
    }
    if (token.type === "bold" || token.type === "italic" || token.type === "spoiler") {
      return token.content.reduce((sum, t) => sum + getTextLength(t), 0)
    }
    if (token.type === "link") {
      return token.text.length
    }
    if (token.type === "mention") {
      return token.name.length + 1 // +1 for @ or #
    }
    return 0
  }

  const renderToken = (
    token: MarkdownToken,
    key: string | number,
  ): React.ReactNode => {
    switch (token.type) {
      case "text":
        return <span key={key}>{token.content}</span>

      case "bold":
        return (
          <strong key={key} className="font-bold">
            {token.content.map((t, i) => renderToken(t, `${key}-${i}`))}
          </strong>
        )

      case "italic":
        return (
          <em key={key} className="italic">
            {token.content.map((t, i) => renderToken(t, `${key}-${i}`))}
          </em>
        )

      case "spoiler": {
        const currentIndex = spoilerIndex++
        const isRevealed = revealedSpoilers.has(currentIndex)
        const content = token.content.map((t, i) => renderToken(t, `${key}-${i}`))
        const textLength = token.content.reduce(
          (sum, t) => sum + getTextLength(t),
          0,
        )
        // "█" is typically ~1.5-2x wider than regular characters, so use ~60% of text length
        const coverLength = Math.max(1, Math.ceil(textLength * 0.6))
        return (
          <span
            key={key}
            onClick={() => toggleSpoiler(currentIndex)}
            className={cn(
              "cursor-pointer rounded px-1 transition-colors relative inline-block",
              isRevealed
                ? "bg-transparent text-foreground border border-muted-foreground/30"
                : "bg-muted-foreground text-muted-foreground border-r border-l border-muted-foreground/30",
            )}
            title={isRevealed ? undefined : "Click to reveal"}
          >
            {isRevealed ? (
              content
            ) : (
              <>
                <span className="invisible whitespace-pre-wrap">{content}</span>
                <span className="absolute inset-0 px-1 overflow-hidden">
                  <span className="whitespace-pre-wrap">
                    {"█".repeat(coverLength)}
                  </span>
                </span>
              </>
            )}
          </span>
        )
      }

      case "link":
        // Validate URL before rendering - if invalid, render as plain text
        if (isValidUrl(token.url)) {
          return (
            <a
              key={key}
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className="chat-link"
            >
              {token.text}
            </a>
          )
        }
        // Invalid URL - render as plain text
        return <span key={key}>{token.text}</span>

      case "mention": {
        const hasId = !!token.mentionId
        const hasServerId = !!serverId
        // Validate mention ID is a UUID before using it in URLs
        const isValidId = hasId && token.mentionId ? isValidUuid(token.mentionId) : false
        const canLink = isValidId && hasServerId

        // Check if this is a self-mention (user mentions themselves)
        const isSelfMention = token.mentionType === "user" && (
          (currentUserId && token.mentionId && token.mentionId === currentUserId) ||
          (currentUserName && token.name && token.name.toLowerCase() === currentUserName.toLowerCase())
        )

        if (canLink) {
          const href =
            token.mentionType === "user"
              ? `/servers/${serverId}/conversations/${token.mentionId}`
              : `/servers/${serverId}/channels/${token.mentionId}`

          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "chat-link font-medium px-1 py-0.5 rounded transition-colors",
                isSelfMention
                  ? "bg-atomicorange-700 text-white hover:bg-atomicorange-800 font-semibold decoration-atomicorange-300"
                  : "bg-lavender-800/50 hover:bg-lavender-700/50"
              )}
              data-mention-name={token.name}
              data-mention-type={token.mentionType}
              data-mention-id={token.mentionId}
              data-self-mention={isSelfMention ? "true" : "false"}
            >
              {token.mentionType === "user" ? "@" : "#"}
              {token.name}
            </Link>
          )
        }

        // Render as plain text for mentions without ID, invalid ID, or serverId
        // Still check for self-mention to apply styling
        return (
          <span
            key={key}
            className={cn(
              isSelfMention &&
              "bg-atomicorange-600/80 text-white font-semibold px-1 py-0.5 rounded"
            )}
          >
            {token.mentionType === "user" ? "@" : "#"}
            {token.name}
          </span>
        )
      }

      case "quote":
        return (
          <blockquote
            key={key}
            className="border-l-4 border-muted-foreground/30 pl-3 my-1 italic text-muted-foreground"
          >
            {token.content.map((t, i) => renderToken(t, `${key}-${i}`))}
          </blockquote>
        )

      case "lineBreak":
        return <br key={key} />

      default:
        return null
    }
  }

  return (
    <div className={cn("inline", className)}>
      {tokens.map((token, i) => renderToken(token, i))}
    </div>
  )
}

