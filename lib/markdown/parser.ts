/**
 * Markdown parser for chat messages
 * 
 * Supports:
 * - **bold** - Bold text formatting
 * - *italic* - Italic text formatting
 * - > quote - Block quotes
 * - ||spoiler|| - Spoiler text
 * - [text](url) - Links with URL validation
 * - Auto-detected URLs (http://, https://)
 * - @username[id] or @username - User mentions with optional UUID
 * - #channelname[id] or #channelname - Channel mentions with optional UUID
 * 
 * Security features:
 * - Validates URLs to prevent XSS (only allows http://, https://, mailto:)
 * - Validates mention IDs are UUIDs
 * - Sanitizes mention names (length limits, character validation)
 * - Rejects protocol-relative URLs
 * - Handles URL encoding to prevent encoded protocol attacks
 */

import { isValidUuid, isValidUrl } from "@/lib/url-validation"

/**
 * Maximum length for mention names to prevent DoS attacks
 */
const MAX_MENTION_NAME_LENGTH = 50

/**
 * Sanitizes and validates a mention name
 * - Truncates to max length
 * - Ensures only valid characters (alphanumeric, underscore, hyphen)
 * - Returns empty string if invalid
 */
function sanitizeMentionName(name: string): string {
  if (!name || typeof name !== "string") {
    return ""
  }
  
  // Truncate to max length
  const truncated = name.slice(0, MAX_MENTION_NAME_LENGTH)
  
  // Validate characters (alphanumeric, underscore, hyphen)
  // This matches the regex pattern used for extraction
  if (!/^[a-zA-Z0-9_-]+$/.test(truncated)) {
    return ""
  }
  
  return truncated
}

export type MarkdownToken =
  | { type: "text"; content: string }
  | { type: "bold"; content: MarkdownToken[] }
  | { type: "italic"; content: MarkdownToken[] }
  | { type: "spoiler"; content: MarkdownToken[] }
  | { type: "link"; text: string; url: string }
  | { type: "quote"; content: MarkdownToken[] }
  | { type: "mention"; name: string; mentionType: "user" | "channel"; mentionId?: string }
  | { type: "lineBreak" }

/**
 * Parses markdown text into a tree of tokens
 */
export function parseMarkdown(text: string): MarkdownToken[] {
  if (!text) return []

  const tokens: MarkdownToken[] = []
  const lines = text.split("\n")

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const isQuote = line.trim().startsWith(">")

    if (isQuote) {
      // Remove the > prefix and parse the rest
      const quoteContent = line.replace(/^>\s*/, "")
      tokens.push({
        type: "quote",
        content: parseInlineMarkdown(quoteContent),
      })
    } else {
      // Parse regular line with inline markdown
      const lineTokens = parseInlineMarkdown(line)
      tokens.push(...lineTokens)
    }

    // Add line break except for the last line
    if (lineIndex < lines.length - 1) {
      tokens.push({ type: "lineBreak" })
    }
  }

  return tokens
}

/**
 * Parses inline markdown (bold, italic, spoiler, links, URLs)
 */
function parseInlineMarkdown(text: string): MarkdownToken[] {
  if (!text) return []

  const tokens: MarkdownToken[] = []
  let i = 0

  while (i < text.length) {
    // Try to match markdown patterns in order of specificity
    // 1. Mentions @username[id] or #channelname[id] (with ID) or @username or #channelname (without ID)
    const mentionWithIdMatch = text.slice(i).match(/^(@|#)([a-zA-Z0-9_-]+)\[([a-zA-Z0-9_-]+)\]/)
    if (mentionWithIdMatch) {
      const mentionId = mentionWithIdMatch[3]
      const mentionName = sanitizeMentionName(mentionWithIdMatch[2])
      
      // Skip if mention name is invalid after sanitization
      if (!mentionName) {
        i += mentionWithIdMatch[0].length
        continue
      }
      
      // Validate mention ID is a UUID - if not, treat as mention without ID
      if (isValidUuid(mentionId)) {
        tokens.push({
          type: "mention",
          name: mentionName,
          mentionType: mentionWithIdMatch[1] === "@" ? "user" : "channel",
          mentionId: mentionId,
        })
      } else {
        // Invalid UUID - treat as mention without ID
        tokens.push({
          type: "mention",
          name: mentionName,
          mentionType: mentionWithIdMatch[1] === "@" ? "user" : "channel",
        })
      }
      i += mentionWithIdMatch[0].length
      continue
    }
    const mentionMatch = text.slice(i).match(/^(@|#)([a-zA-Z0-9_-]+)/)
    if (mentionMatch) {
      const mentionName = sanitizeMentionName(mentionMatch[2])
      
      // Skip if mention name is invalid after sanitization
      if (!mentionName) {
        i += mentionMatch[0].length
        continue
      }
      
      tokens.push({
        type: "mention",
        name: mentionName,
        mentionType: mentionMatch[1] === "@" ? "user" : "channel",
      })
      i += mentionMatch[0].length
      continue
    }

    // 2. Links [text](url) - most specific
    const linkMatch = text.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      const url = linkMatch[2]
      // Validate URL protocol - only allow http://, https://, mailto:
      if (isValidUrl(url)) {
        tokens.push({
          type: "link",
          text: linkMatch[1],
          url: url,
        })
      } else {
        // Invalid URL - render as plain text
        tokens.push({
          type: "text",
          content: linkMatch[0],
        })
      }
      i += linkMatch[0].length
      continue
    }

    // 3. Bold **text** - non-greedy match to handle nested formatting
    const boldMatch = text.slice(i).match(/^\*\*(.+?)\*\*/)
    if (boldMatch && boldMatch[1].length > 0) {
      const boldContent = parseInlineMarkdown(boldMatch[1])
      tokens.push({
        type: "bold",
        content: boldContent,
      })
      i += boldMatch[0].length
      continue
    }

    // 4. Spoiler ||text|| - non-greedy match to handle nested formatting
    const spoilerMatch = text.slice(i).match(/^\|\|(.+?)\|\|/)
    if (spoilerMatch && spoilerMatch[1].length > 0) {
      const spoilerContent = parseInlineMarkdown(spoilerMatch[1])
      tokens.push({
        type: "spoiler",
        content: spoilerContent,
      })
      i += spoilerMatch[0].length
      continue
    }

    // 5. Italic *text* (but not **text**)
    const italicMatch = text.slice(i).match(/^\*([^*\n]+)\*/)
    if (italicMatch) {
      const italicContent = parseInlineMarkdown(italicMatch[1])
      tokens.push({
        type: "italic",
        content: italicContent,
      })
      i += italicMatch[0].length
      continue
    }

    // 6. Auto-detect URLs (http://, https://)
    const urlMatch = text.slice(i).match(/^(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/i)
    if (urlMatch) {
      const url = urlMatch[1]
      // Validate URL protocol
      if (isValidUrl(url)) {
        tokens.push({
          type: "link",
          text: url,
          url: url,
        })
      } else {
        // Invalid URL - render as plain text
        tokens.push({
          type: "text",
          content: url,
        })
      }
      i += urlMatch[1].length
      continue
    }

    // 7. Regular text - collect until next markdown pattern
    let textEnd = i
    while (textEnd < text.length) {
      const remaining = text.slice(textEnd)
      // Check if any markdown pattern starts here
      if (
        remaining.match(/^(\[|https?:\/\/|\*\*|\*|\|\||@|#)/i)
      ) {
        break
      }
      textEnd++
    }

    if (textEnd > i) {
      const textContent = text.slice(i, textEnd)
      tokens.push({
        type: "text",
        content: textContent,
      })
      i = textEnd
    } else {
      // Fallback: single character
      tokens.push({
        type: "text",
        content: text[i],
      })
      i++
    }
  }

  return tokens
}

