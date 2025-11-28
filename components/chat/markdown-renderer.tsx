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
        return (
          <span
            key={key}
            onClick={() => toggleSpoiler(currentIndex)}
            className={cn(
              "cursor-pointer rounded px-1 transition-colors",
              isRevealed
                ? "bg-transparent text-foreground"
                : "bg-foreground text-foreground",
            )}
            title={isRevealed ? undefined : "Click to reveal"}
          >
            {isRevealed
              ? token.content.map((t, i) => renderToken(t, `${key}-${i}`))
              : "█".repeat(
                token.content
                  .map((t) => {
                    if (t.type === "text") return t.content.length
                    return 10 // Approximate length for nested content
                  })
                  .reduce((a, b) => a + b, 0),
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
        const isValidId = hasId && isValidUuid(token.mentionId)
        const canLink = isValidId && hasServerId

        if (canLink) {
          const href =
            token.mentionType === "user"
              ? `/servers/${serverId}/conversations/${token.mentionId}`
              : `/servers/${serverId}/channels/${token.mentionId}`

          return (
            <Link
              key={key}
              href={href}
              className="chat-link bg-lavender-800/50 font-medium px-1 py-0.5 rounded hover:bg-lavender-700/50 transition-colors"
              data-mention-name={token.name}
              data-mention-type={token.mentionType}
              data-mention-id={token.mentionId}
            >
              {token.mentionType === "user" ? "@" : "#"}
              {token.name}
            </Link>
          )
        }

        // Render as plain text for mentions without ID, invalid ID, or serverId
        return (
          <span key={key}>
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

