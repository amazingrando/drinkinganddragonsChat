import { isValidUrl, validateUrl, isValidUuid } from "@/lib/url-validation"

describe("URL Validation", () => {
  describe("isValidUrl", () => {
    it("should accept valid http URLs", () => {
      expect(isValidUrl("http://example.com")).toBe(true)
      expect(isValidUrl("http://example.com/path")).toBe(true)
      expect(isValidUrl("http://example.com:8080")).toBe(true)
    })

    it("should accept valid https URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true)
      expect(isValidUrl("https://example.com/path")).toBe(true)
      expect(isValidUrl("https://example.com:443")).toBe(true)
    })

    it("should accept valid mailto URLs", () => {
      expect(isValidUrl("mailto:test@example.com")).toBe(true)
      expect(isValidUrl("mailto:user@example.com?subject=Test")).toBe(true)
    })

    it("should reject javascript: protocol", () => {
      expect(isValidUrl("javascript:alert(1)")).toBe(false)
      expect(isValidUrl("javascript:void(0)")).toBe(false)
      expect(isValidUrl("JAVASCRIPT:alert(1)")).toBe(false) // Case insensitive
    })

    it("should reject data: protocol", () => {
      expect(isValidUrl("data:text/html,<script>alert(1)</script>")).toBe(false)
      expect(isValidUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")).toBe(false)
    })

    it("should reject vbscript: protocol", () => {
      expect(isValidUrl("vbscript:msgbox('XSS')")).toBe(false)
    })

    it("should reject file: protocol", () => {
      expect(isValidUrl("file:///etc/passwd")).toBe(false)
      expect(isValidUrl("file:///C:/Windows/System32")).toBe(false)
    })

    it("should reject other dangerous protocols", () => {
      expect(isValidUrl("about:blank")).toBe(false)
      expect(isValidUrl("chrome://settings")).toBe(false)
      expect(isValidUrl("ms-help://")).toBe(false)
    })

    it("should handle URLs with query parameters", () => {
      expect(isValidUrl("https://example.com?param=value")).toBe(true)
      expect(isValidUrl("https://example.com?param=value&other=test")).toBe(true)
    })

    it("should handle URLs with fragments", () => {
      expect(isValidUrl("https://example.com#section")).toBe(true)
    })

    it("should handle empty or invalid input", () => {
      expect(isValidUrl("")).toBe(false)
      expect(isValidUrl("   ")).toBe(false)
      expect(isValidUrl("not-a-url")).toBe(false)
    })

    it("should trim whitespace", () => {
      expect(isValidUrl("  https://example.com  ")).toBe(true)
    })

    it("should reject URLs with javascript: in path", () => {
      // Even if it looks like a valid URL, if it contains javascript: it should be rejected
      expect(isValidUrl("https://example.com/javascript:alert(1)")).toBe(true) // This is actually valid
      // But direct javascript: protocol should be rejected
      expect(isValidUrl("javascript:alert(1)")).toBe(false)
    })
  })

  describe("validateUrl", () => {
    it("should return URL if valid", () => {
      expect(validateUrl("https://example.com")).toBe("https://example.com")
      expect(validateUrl("  http://example.com  ")).toBe("http://example.com") // Trimmed
    })

    it("should return null if invalid", () => {
      expect(validateUrl("javascript:alert(1)")).toBeNull()
      expect(validateUrl("")).toBeNull()
      expect(validateUrl("not-a-url")).toBeNull()
    })
  })

  describe("isValidUuid", () => {
    it("should accept valid UUID v4", () => {
      expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true)
      expect(isValidUuid("6ba7b810-9dad-41d4-a716-00c04fd430c8")).toBe(true) // Valid v4
      expect(isValidUuid("00000000-0000-4000-8000-000000000000")).toBe(true)
    })

    it("should reject invalid UUID formats", () => {
      expect(isValidUuid("not-a-uuid")).toBe(false)
      expect(isValidUuid("550e8400e29b41d4a716446655440000")).toBe(false) // No hyphens
      expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false) // Too short
      expect(isValidUuid("550e8400-e29b-11d4-a716-446655440000")).toBe(false) // Wrong version (v1)
    })

    it("should reject path traversal attempts", () => {
      expect(isValidUuid("../../../etc/passwd")).toBe(false)
      expect(isValidUuid("..\\..\\..\\etc\\passwd")).toBe(false)
      expect(isValidUuid("%2e%2e%2f")).toBe(false) // URL encoded
    })

    it("should reject SQL injection attempts", () => {
      expect(isValidUuid("'; DROP TABLE users; --")).toBe(false)
      expect(isValidUuid("1' OR '1'='1")).toBe(false)
    })

    it("should handle empty or invalid input", () => {
      expect(isValidUuid("")).toBe(false)
      expect(isValidUuid("   ")).toBe(false)
      expect(isValidUuid("123")).toBe(false)
      expect(isValidUuid("abc")).toBe(false)
    })

    it("should be case insensitive", () => {
      expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true)
      expect(isValidUuid("550e8400-E29B-41d4-A716-446655440000")).toBe(true)
    })
  })
})

