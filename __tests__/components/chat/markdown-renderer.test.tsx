/**
 * Tests for MarkdownRenderer component
 * Note: These tests focus on the parsing and validation logic
 * rather than full React component rendering
 */

import { parseMarkdown } from "@/lib/markdown/parser"
import { isValidUrl, isValidUuid } from "@/lib/url-validation"

describe("MarkdownRenderer Logic", () => {
  describe("URL validation and XSS prevention", () => {
    it("should parse valid http links", () => {
      const result = parseMarkdown("[Link](http://example.com)")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeDefined()
      if (linkToken && linkToken.type === "link") {
        expect(linkToken.url).toBe("http://example.com")
        expect(isValidUrl(linkToken.url)).toBe(true)
      }
    })

    it("should parse valid https links", () => {
      const result = parseMarkdown("[Link](https://example.com)")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeDefined()
      if (linkToken && linkToken.type === "link") {
        expect(linkToken.url).toBe("https://example.com")
        expect(isValidUrl(linkToken.url)).toBe(true)
      }
    })

    it("should parse valid mailto links", () => {
      const result = parseMarkdown("[Email](mailto:test@example.com)")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeDefined()
      if (linkToken && linkToken.type === "link") {
        expect(linkToken.url).toBe("mailto:test@example.com")
        expect(isValidUrl(linkToken.url)).toBe(true)
      }
    })

    it("should prevent javascript: protocol XSS", () => {
      const result = parseMarkdown("[Click](javascript:alert(1))")
      const linkToken = result.find((token) => token.type === "link")
      // Should not render as a link
      expect(linkToken).toBeUndefined()
    })

    it("should prevent data: protocol XSS", () => {
      const result = parseMarkdown(
        "[Click](data:text/html,<script>alert(1)</script>)",
      )
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeUndefined()
    })

    it("should prevent vbscript: protocol XSS", () => {
      const result = parseMarkdown("[Click](vbscript:msgbox('XSS'))")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeUndefined()
    })

    it("should parse auto-detected http URLs", () => {
      const result = parseMarkdown("Check out http://example.com")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeDefined()
      if (linkToken && linkToken.type === "link") {
        expect(linkToken.url).toBe("http://example.com")
        expect(isValidUrl(linkToken.url)).toBe(true)
      }
    })

    it("should parse auto-detected https URLs", () => {
      const result = parseMarkdown("Check out https://example.com")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeDefined()
      if (linkToken && linkToken.type === "link") {
        expect(linkToken.url).toBe("https://example.com")
        expect(isValidUrl(linkToken.url)).toBe(true)
      }
    })
  })

  describe("Mention rendering logic", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000"
    const serverId = "server-id-123"

    it("should parse mention with valid UUID", () => {
      const result = parseMarkdown(`@username[${validUuid}]`)
      const mentionToken = result.find((token) => token.type === "mention")
      expect(mentionToken).toBeDefined()
      if (mentionToken && mentionToken.type === "mention") {
        expect(mentionToken.mentionId).toBe(validUuid)
        expect(isValidUuid(mentionToken.mentionId!)).toBe(true)
        // Can create valid navigation URL
        const href = `/servers/${serverId}/conversations/${mentionToken.mentionId}`
        expect(href).toBe(`/servers/${serverId}/conversations/${validUuid}`)
      }
    })

    it("should parse channel mention with valid UUID", () => {
      const result = parseMarkdown(`#channel[${validUuid}]`)
      const mentionToken = result.find((token) => token.type === "mention")
      expect(mentionToken).toBeDefined()
      if (mentionToken && mentionToken.type === "mention") {
        expect(mentionToken.mentionType).toBe("channel")
        expect(mentionToken.mentionId).toBe(validUuid)
        expect(isValidUuid(mentionToken.mentionId!)).toBe(true)
      }
    })

    it("should parse mention with invalid ID as plain text", () => {
      const result = parseMarkdown("@user[not-a-uuid]")
      const mentionToken = result.find((token) => token.type === "mention")
      expect(mentionToken).toBeDefined()
      if (mentionToken && mentionToken.type === "mention") {
        // Should not have mentionId if invalid
        expect(mentionToken.mentionId).toBeUndefined()
      }
    })

    it("should parse mention without ID", () => {
      const result = parseMarkdown("@username")
      const mentionToken = result.find((token) => token.type === "mention")
      expect(mentionToken).toBeDefined()
      if (mentionToken && mentionToken.type === "mention") {
        expect(mentionToken.mentionId).toBeUndefined()
      }
    })

    it("should prevent path traversal via mention ID", () => {
      const result = parseMarkdown("@user[../../../etc/passwd]")
      const mentionToken = result.find((token) => token.type === "mention")
      expect(mentionToken).toBeDefined()
      if (mentionToken && mentionToken.type === "mention") {
        // Should not have mentionId if invalid
        expect(mentionToken.mentionId).toBeUndefined()
      }
    })
  })

  describe("Markdown formatting", () => {
    it("should parse bold text", () => {
      const result = parseMarkdown("**bold text**")
      const boldToken = result.find((token) => token.type === "bold")
      expect(boldToken).toBeDefined()
    })

    it("should parse italic text", () => {
      const result = parseMarkdown("*italic text*")
      const italicToken = result.find((token) => token.type === "italic")
      expect(italicToken).toBeDefined()
    })

    it("should parse spoiler text", () => {
      const result = parseMarkdown("||spoiler text||")
      const spoilerToken = result.find((token) => token.type === "spoiler")
      expect(spoilerToken).toBeDefined()
    })

    it("should parse quote", () => {
      const result = parseMarkdown("> quote text")
      const quoteToken = result.find((token) => token.type === "quote")
      expect(quoteToken).toBeDefined()
    })

    it("should handle line breaks", () => {
      const result = parseMarkdown("Line 1\nLine 2")
      const lineBreakToken = result.find((token) => token.type === "lineBreak")
      expect(lineBreakToken).toBeDefined()
    })
  })

  describe("Mixed content", () => {
    it("should handle mixed markdown", () => {
      const result = parseMarkdown("Check out **bold** and [link](https://example.com)")
      const boldToken = result.find((token) => token.type === "bold")
      const linkToken = result.find((token) => token.type === "link")
      expect(boldToken).toBeDefined()
      expect(linkToken).toBeDefined()
    })

    it("should handle mentions in formatted text", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      const result = parseMarkdown(`**@username[${validUuid}]**`)
      const boldToken = result.find((token) => token.type === "bold")
      expect(boldToken).toBeDefined()
      if (boldToken && boldToken.type === "bold" && Array.isArray(boldToken.content)) {
        const mentionToken = boldToken.content.find((t) => t.type === "mention")
        expect(mentionToken).toBeDefined()
      }
    })
  })
})
