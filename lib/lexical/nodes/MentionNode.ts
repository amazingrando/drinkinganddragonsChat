import {
  $applyNodeReplacement,
  $isTextNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedTextNode,
  Spread,
  TextNode,
} from "lexical"
import { isValidUuid } from "@/lib/url-validation"

export type SerializedMentionNode = Spread<
  {
    mentionName: string
    mentionType: "user" | "channel"
    mentionId: string
  },
  SerializedTextNode
>

export class MentionNode extends TextNode {
  __mentionName: string
  __mentionType: "user" | "channel"
  __mentionId: string

  static getType(): string {
    return "mention"
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(
      node.__mentionName,
      node.__mentionType,
      node.__mentionId,
      node.__text,
      node.__key,
    )
  }

  constructor(
    mentionName: string,
    mentionType: "user" | "channel",
    mentionId: string,
    text?: string,
    key?: NodeKey,
  ) {
    super(text ?? `@${mentionName}`, key)
    this.__mentionName = mentionName
    this.__mentionType = mentionType
    this.__mentionId = mentionId
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config)
    element.className = config.theme.mention || ""
    element.setAttribute("data-mention-name", this.__mentionName)
    element.setAttribute("data-mention-type", this.__mentionType)
    element.setAttribute("data-mention-id", this.__mentionId)
    return element
  }

  /**
   * Imports DOM nodes into Lexical MentionNodes
   * Validates mentionId to prevent importing malicious data from user-generated HTML
   */
  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: Node) => ({
        conversion: (domNode: HTMLElement) => {
          if (!domNode.hasAttribute("data-mention-name")) {
            return null
          }
          const mentionName = domNode.getAttribute("data-mention-name") || ""
          const mentionType = (domNode.getAttribute("data-mention-type") || "user") as "user" | "channel"
          const mentionId = domNode.getAttribute("data-mention-id") || ""
          
          // Validate mentionId is a valid UUID to prevent path traversal and other attacks
          // If invalid, create node without mentionId (will render as plain text mention)
          const validMentionId = mentionId && isValidUuid(mentionId) ? mentionId : ""
          
          const node = $createMentionNode(mentionName, mentionType, validMentionId)
          return { node }
        },
        priority: 1,
      }),
    }
  }

  /**
   * Imports JSON-serialized MentionNode
   * Validates mentionId to ensure data integrity
   */
  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    const { mentionName, mentionType, mentionId, text } = serializedNode
    // Validate mentionId - if invalid, use empty string (will render as plain text mention)
    const validMentionId = mentionId && isValidUuid(mentionId) ? mentionId : ""
    const node = $createMentionNode(mentionName, mentionType, validMentionId, text)
    return node
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span")
    element.setAttribute("data-mention-name", this.__mentionName)
    element.setAttribute("data-mention-type", this.__mentionType)
    element.setAttribute("data-mention-id", this.__mentionId)
    element.textContent = this.__text
    return { element }
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      mentionName: this.__mentionName,
      mentionType: this.__mentionType,
      mentionId: this.__mentionId,
      type: "mention",
      version: 1,
    }
  }

  getMentionName(): string {
    return this.__mentionName
  }

  getMentionType(): "user" | "channel" {
    return this.__mentionType
  }

  getMentionId(): string {
    return this.__mentionId
  }

  canInsertTextBefore(): boolean {
    return false
  }

  canInsertTextAfter(): boolean {
    return false
  }

  isInline(): boolean {
    return true
  }
}

export function $createMentionNode(
  mentionName: string,
  mentionType: "user" | "channel",
  mentionId: string,
  text?: string,
): MentionNode {
  const mentionNode = new MentionNode(mentionName, mentionType, mentionId, text)
  mentionNode.setMode("segmented").toggleDirectionless()
  return $applyNodeReplacement(mentionNode)
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode
}

