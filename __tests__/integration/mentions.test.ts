import { parseMarkdown } from "@/lib/markdown/parser"
import { isValidUrl, isValidUuid } from "@/lib/url-validation"

/**
 * Integration tests for the complete mention flow
 * Tests the interaction between parser, validation, and rendering
 */
describe("Mention Integration Tests", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000"
  const serverId = "server-id-123"

  describe("Complete mention flow", () => {
    it("should parse, validate, and prepare mention for rendering", () => {
      // Step 1: Parse markdown with mention
      const markdown = `@username[${validUuid}]`
      const tokens = parseMarkdown(markdown)

      // Step 2: Verify mention token was created
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe("mention")
      if (tokens[0].type === "mention") {
        // Step 3: Verify mention has valid UUID
        expect(tokens[0].mentionId).toBe(validUuid)
        expect(isValidUuid(tokens[0].mentionId!)).toBe(true)

        // Step 4: Verify mention can be used to create navigation URL
        const href = `/servers/${serverId}/conversations/${tokens[0].mentionId}`
        expect(href).toBe(`/servers/${serverId}/conversations/${validUuid}`)
      }
    })

    it("should handle channel mentions correctly", () => {
      const markdown = `#general[${validUuid}]`
      const tokens = parseMarkdown(markdown)

      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe("mention")
      if (tokens[0].type === "mention") {
        expect(tokens[0].mentionType).toBe("channel")
        expect(tokens[0].mentionId).toBe(validUuid)
        expect(isValidUuid(tokens[0].mentionId!)).toBe(true)
      }
    })

    it("should handle mentions without IDs", () => {
      const markdown = "@username"
      const tokens = parseMarkdown(markdown)

      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe("mention")
      if (tokens[0].type === "mention") {
        expect(tokens[0].mentionId).toBeUndefined()
      }
    })
  })

  describe("Mention with formatting", () => {
    it("should handle mentions in bold text", () => {
      const markdown = `**@username[${validUuid}]**`
      const tokens = parseMarkdown(markdown)

      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe("bold")
      if (tokens[0].type === "bold" && Array.isArray(tokens[0].content)) {
        const mentionToken = tokens[0].content.find((t) => t.type === "mention")
        expect(mentionToken).toBeDefined()
        if (mentionToken && mentionToken.type === "mention") {
          expect(mentionToken.mentionId).toBe(validUuid)
        }
      }
    })

    it("should handle mentions in italic text", () => {
      const markdown = `*@username[${validUuid}]*`
      const tokens = parseMarkdown(markdown)

      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe("italic")
    })
  })

  describe("Mention with links", () => {
    it("should handle mentions and links in same message", () => {
      const markdown = `@username[${validUuid}] Check out https://example.com`
      const tokens = parseMarkdown(markdown)

      const mentionToken = tokens.find((t) => t.type === "mention")
      const linkToken = tokens.find((t) => t.type === "link")

      expect(mentionToken).toBeDefined()
      expect(linkToken).toBeDefined()

      if (linkToken && linkToken.type === "link") {
        expect(isValidUrl(linkToken.url)).toBe(true)
      }
    })
  })

  describe("Error handling in mention flow", () => {
    it("should gracefully handle invalid mention IDs", () => {
      const markdown = "@user[not-a-uuid]"
      const tokens = parseMarkdown(markdown)

      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe("mention")
      if (tokens[0].type === "mention") {
        // Should not have mentionId if invalid
        expect(tokens[0].mentionId).toBeUndefined()
        // But should still have name and type
        expect(tokens[0].name).toBe("user")
        expect(tokens[0].mentionType).toBe("user")
      }
    })

    it("should handle mixed valid and invalid mentions", () => {
      const markdown = `@valid[${validUuid}] @invalid[not-a-uuid]`
      const tokens = parseMarkdown(markdown)

      const validMention = tokens.find(
        (t) => t.type === "mention" && t.mentionId === validUuid,
      )
      const invalidMention = tokens.find(
        (t) => t.type === "mention" && !t.mentionId,
      )

      expect(validMention).toBeDefined()
      expect(invalidMention).toBeDefined()
    })
  })

  describe("Real-world scenarios", () => {
    it("should handle a complete message with mentions, links, and formatting", () => {
      const markdown = `Hey @user[${validUuid}], check out **this link** https://example.com and visit #channel[${validUuid}]`
      const tokens = parseMarkdown(markdown)

      // Should have multiple tokens
      expect(tokens.length).toBeGreaterThan(1)

      // Should have user mention
      const userMention = tokens.find(
        (t) => t.type === "mention" && t.mentionType === "user",
      )
      expect(userMention).toBeDefined()

      // Should have channel mention
      const channelMention = tokens.find(
        (t) => t.type === "mention" && t.mentionType === "channel",
      )
      expect(channelMention).toBeDefined()

      // Should have link
      const link = tokens.find((t) => t.type === "link")
      expect(link).toBeDefined()

      // Should have bold formatting
      const bold = tokens.find((t) => t.type === "bold")
      expect(bold).toBeDefined()
    })

    it("should handle message with multiple mentions", () => {
      const uuid1 = "550e8400-e29b-41d4-a716-446655440000"
      const uuid2 = "650e8400-e29b-41d4-a716-446655440001"
      const markdown = `@user1[${uuid1}] and @user2[${uuid2}]`
      const tokens = parseMarkdown(markdown)

      const mentions = tokens.filter((t) => t.type === "mention")
      expect(mentions.length).toBeGreaterThanOrEqual(2)

      mentions.forEach((mention) => {
        if (mention.type === "mention") {
          expect(mention.mentionId).toBeDefined()
          if (mention.mentionId) {
            expect(isValidUuid(mention.mentionId)).toBe(true)
          }
        }
      })
    })
  })
})

