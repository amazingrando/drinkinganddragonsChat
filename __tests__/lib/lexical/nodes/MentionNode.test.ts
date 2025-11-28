/**
 * @jest-environment jsdom
 */
import { MentionNode, $createMentionNode, $isMentionNode } from "@/lib/lexical/nodes"
import { $getRoot, $createParagraphNode, createEditor } from "lexical"
import { MentionNode as MentionNodeType } from "@/lib/lexical/nodes"

describe("MentionNode", () => {
  let editor: ReturnType<typeof createEditor>

  beforeEach(() => {
    editor = createEditor({
      namespace: "test",
      nodes: [MentionNodeType],
      onError: () => {},
    })
  })

  describe("Node creation", () => {
    it("should create a mention node with all properties", () => {
      editor.update(() => {
        const node = $createMentionNode("username", "user", "550e8400-e29b-41d4-a716-446655440000")
        expect(node).toBeInstanceOf(MentionNode)
        expect(node.getMentionName()).toBe("username")
        expect(node.getMentionType()).toBe("user")
        expect(node.getMentionId()).toBe("550e8400-e29b-41d4-a716-446655440000")
      })
    })

    it("should create a channel mention node", () => {
      editor.update(() => {
        const node = $createMentionNode("general", "channel", "550e8400-e29b-41d4-a716-446655440000")
        expect(node.getMentionType()).toBe("channel")
      })
    })

    it("should create mention node with custom text", () => {
      editor.update(() => {
        const node = $createMentionNode(
          "username",
          "user",
          "550e8400-e29b-41d4-a716-446655440000",
          "@username",
        )
        expect(node.getTextContent()).toBe("@username")
      })
    })
  })

  describe("Node type checking", () => {
    it("should identify mention nodes", () => {
      editor.update(() => {
        const node = $createMentionNode("username", "user", "550e8400-e29b-41d4-a716-446655440000")
        expect($isMentionNode(node)).toBe(true)
      })
    })

    it("should return false for non-mention nodes", () => {
      editor.update(() => {
        const paragraph = $createParagraphNode()
        expect($isMentionNode(paragraph)).toBe(false)
        expect($isMentionNode(null)).toBe(false)
        expect($isMentionNode(undefined)).toBe(false)
      })
    })
  })

  describe("Node properties", () => {
    it("should return correct mention name", () => {
      editor.update(() => {
        const node = $createMentionNode("testuser", "user", "550e8400-e29b-41d4-a716-446655440000")
        expect(node.getMentionName()).toBe("testuser")
      })
    })

    it("should return correct mention type", () => {
      editor.update(() => {
        const node = $createMentionNode("channel", "channel", "550e8400-e29b-41d4-a716-446655440000")
        expect(node.getMentionType()).toBe("channel")
      })
    })

    it("should return correct mention ID", () => {
      editor.update(() => {
        const id = "550e8400-e29b-41d4-a716-446655440000"
        const node = $createMentionNode("username", "user", id)
        expect(node.getMentionId()).toBe(id)
      })
    })
  })

  describe("Node behavior", () => {
    it("should not allow text insertion before", () => {
      editor.update(() => {
        const node = $createMentionNode("username", "user", "550e8400-e29b-41d4-a716-446655440000")
        expect(node.canInsertTextBefore()).toBe(false)
      })
    })

    it("should not allow text insertion after", () => {
      editor.update(() => {
        const node = $createMentionNode("username", "user", "550e8400-e29b-41d4-a716-446655440000")
        expect(node.canInsertTextAfter()).toBe(false)
      })
    })

    it("should be inline", () => {
      editor.update(() => {
        const node = $createMentionNode("username", "user", "550e8400-e29b-41d4-a716-446655440000")
        expect(node.isInline()).toBe(true)
      })
    })
  })

  describe("Serialization", () => {
    it("should serialize to JSON", () => {
      editor.update(() => {
        const node = $createMentionNode("username", "user", "550e8400-e29b-41d4-a716-446655440000")
        const serialized = node.exportJSON()
        expect(serialized).toMatchObject({
          type: "mention",
          mentionName: "username",
          mentionType: "user",
          mentionId: "550e8400-e29b-41d4-a716-446655440000",
        })
      })
    })

    it("should deserialize from JSON", () => {
      const serialized = {
        type: "mention",
        mentionName: "username",
        mentionType: "user",
        mentionId: "550e8400-e29b-41d4-a716-446655440000",
        text: "@username",
        version: 1,
      }
      editor.update(() => {
        const node = MentionNode.importJSON(serialized)
        expect(node.getMentionName()).toBe("username")
        expect(node.getMentionType()).toBe("user")
        expect(node.getMentionId()).toBe("550e8400-e29b-41d4-a716-446655440000")
      })
    })
  })

  describe("DOM operations", () => {
    it("should export to DOM with data attributes", () => {
      editor.update(() => {
        const node = $createMentionNode("username", "user", "550e8400-e29b-41d4-a716-446655440000")
        const domExport = node.exportDOM()
        expect(domExport.element).toBeInstanceOf(HTMLElement)
        expect(domExport.element.getAttribute("data-mention-name")).toBe("username")
        expect(domExport.element.getAttribute("data-mention-type")).toBe("user")
        expect(domExport.element.getAttribute("data-mention-id")).toBe("550e8400-e29b-41d4-a716-446655440000")
      })
    })

    it("should import from DOM with data attributes", () => {
      const element = document.createElement("span")
      element.setAttribute("data-mention-name", "username")
      element.setAttribute("data-mention-type", "user")
      element.setAttribute("data-mention-id", "550e8400-e29b-41d4-a716-446655440000")
      element.textContent = "@username"

      const importMap = MentionNode.importDOM()
      expect(importMap).not.toBeNull()
      if (importMap) {
        const spanConverter = importMap.span
        expect(spanConverter).toBeDefined()
        if (spanConverter) {
          const converter = spanConverter(element)
          expect(converter).toBeDefined()
          if (converter) {
            editor.update(() => {
              const conversion = converter.conversion(element)
              expect(conversion).not.toBeNull()
              if (conversion) {
                expect($isMentionNode(conversion.node)).toBe(true)
              }
            })
          }
        }
      }
    })

    it("should not import from DOM without mention attributes", () => {
      const element = document.createElement("span")
      element.textContent = "regular text"

      const importMap = MentionNode.importDOM()
      expect(importMap).not.toBeNull()
      if (importMap) {
        const spanConverter = importMap.span
        expect(spanConverter).toBeDefined()
        if (spanConverter) {
          const converter = spanConverter(element)
          expect(converter).toBeDefined()
          if (converter) {
            const conversion = converter.conversion(element)
            expect(conversion).toBeNull()
          }
        }
      }
    })
  })
})

