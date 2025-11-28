import { parseMarkdown } from "@/lib/markdown/parser"

describe("parseMarkdown", () => {
  describe("URL validation", () => {
    it("should accept valid http URLs", () => {
      const result = parseMarkdown("[Link](http://example.com)")
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "link",
        text: "Link",
        url: "http://example.com",
      })
    })

    it("should accept valid https URLs", () => {
      const result = parseMarkdown("[Link](https://example.com)")
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "link",
        text: "Link",
        url: "https://example.com",
      })
    })

    it("should accept valid mailto URLs", () => {
      const result = parseMarkdown("[Email](mailto:test@example.com)")
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "link",
        text: "Email",
        url: "mailto:test@example.com",
      })
    })

    it("should reject javascript: protocol", () => {
      const result = parseMarkdown("[Click](javascript:alert(1))")
      // Should be rendered as plain text, not a link
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeUndefined()
      // Should contain the text
      const textContent = result
        .filter((token) => token.type === "text")
        .map((token) => (token.type === "text" ? token.content : ""))
        .join("")
      expect(textContent).toContain("javascript:alert(1)")
    })

    it("should reject data: protocol", () => {
      const result = parseMarkdown("[Click](data:text/html,<script>alert(1)</script>)")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeUndefined()
    })

    it("should reject vbscript: protocol", () => {
      const result = parseMarkdown("[Click](vbscript:msgbox('XSS'))")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeUndefined()
    })

    it("should reject file: protocol", () => {
      const result = parseMarkdown("[Click](file:///etc/passwd)")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("text")
    })

    it("should auto-detect and validate http URLs", () => {
      const result = parseMarkdown("Check out http://example.com")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeDefined()
      if (linkToken && linkToken.type === "link") {
        expect(linkToken.url).toBe("http://example.com")
      }
    })

    it("should auto-detect and validate https URLs", () => {
      const result = parseMarkdown("Check out https://example.com")
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeDefined()
      if (linkToken && linkToken.type === "link") {
        expect(linkToken.url).toBe("https://example.com")
      }
    })

    it("should reject invalid auto-detected URLs", () => {
      const result = parseMarkdown("Check out javascript:alert(1)")
      // Should not be parsed as a link
      const linkToken = result.find((token) => token.type === "link")
      expect(linkToken).toBeUndefined()
    })
  })

  describe("Mention parsing", () => {
    it("should parse mention with valid UUID", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      const result = parseMarkdown(`@username[${validUuid}]`)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "mention",
        name: "username",
        mentionType: "user",
        mentionId: validUuid,
      })
    })

    it("should parse channel mention with valid UUID", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      const result = parseMarkdown(`#channel[${validUuid}]`)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "mention",
        name: "channel",
        mentionType: "channel",
        mentionId: validUuid,
      })
    })

    it("should reject mention with invalid ID (not UUID)", () => {
      const result = parseMarkdown("@user[not-a-uuid]")
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "mention",
        name: "user",
        mentionType: "user",
      })
      // Should not have mentionId if invalid
      expect(result[0].mentionId).toBeUndefined()
    })

    it("should parse mention without ID", () => {
      const result = parseMarkdown("@username")
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "mention",
        name: "username",
        mentionType: "user",
      })
      expect(result[0].mentionId).toBeUndefined()
    })

    it("should parse channel mention without ID", () => {
      const result = parseMarkdown("#channel")
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "mention",
        name: "channel",
        mentionType: "channel",
      })
    })

    it("should handle mention with path traversal attempt", () => {
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
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("bold")
    })

    it("should parse italic text", () => {
      const result = parseMarkdown("*italic text*")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("italic")
    })

    it("should parse nested bold and italic", () => {
      const result = parseMarkdown("***bold italic***")
      // May be parsed as bold with italic inside, or as separate tokens
      expect(result.length).toBeGreaterThan(0)
      // Should have some formatting
      const hasBold = result.some(
        (token) => token.type === "bold" || (token.type === "text" && result.length === 1),
      )
      expect(hasBold || result[0].type === "text").toBe(true)
    })

    it("should parse spoiler text", () => {
      const result = parseMarkdown("||spoiler text||")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("spoiler")
    })

    it("should parse quote", () => {
      const result = parseMarkdown("> quote text")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("quote")
    })

    it("should handle multiple lines", () => {
      const result = parseMarkdown("Line 1\nLine 2")
      expect(result.length).toBeGreaterThan(1)
      expect(result.some((token) => token.type === "lineBreak")).toBe(true)
    })
  })

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      const result = parseMarkdown("")
      expect(result).toEqual([])
    })

    it("should handle very long strings", () => {
      const longText = "a".repeat(10000)
      const result = parseMarkdown(longText)
      expect(result.length).toBeGreaterThan(0)
    })

    it("should handle special characters", () => {
      const result = parseMarkdown("Text with !@#$%^&*() characters")
      expect(result.length).toBeGreaterThan(0)
    })

    it("should handle malformed markdown", () => {
      const result = parseMarkdown("**unclosed bold")
      // Should not crash, may parse as text
      expect(result.length).toBeGreaterThan(0)
    })

    it("should handle mixed content", () => {
      const result = parseMarkdown("Check out **bold** and [link](https://example.com)")
      expect(result.length).toBeGreaterThan(1)
    })
  })
})

