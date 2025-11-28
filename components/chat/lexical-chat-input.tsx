"use client"

import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getRoot, $isParagraphNode, EditorState, $createParagraphNode, $isTextNode, $insertNodes, $createTextNode } from "lexical"
import { $isLinkNode } from "@lexical/link"
import { chatEditorTheme } from "@/lib/lexical/theme"
import { MarkdownShortcutsPlugin } from "./lexical-markdown-shortcuts"
import { MentionsPlugin } from "./lexical-mentions-plugin"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { LinkNode } from "@lexical/link"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { ListNode, ListItemNode } from "@lexical/list"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { MentionNode, $isMentionNode } from "@/lib/lexical/nodes"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState, useCallback } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Plus, BarChart3, Send } from "lucide-react"
import { useModal } from "@/hooks/use-modal-store"
import { EmojiPicker } from "@/components/emoji-picker"
import { Member, Profile } from "@prisma/client"
import { $getSelection, $isRangeSelection, KEY_ENTER_COMMAND, COMMAND_PRIORITY_LOW } from "lexical"

interface LexicalChatInputProps {
  apiUrl: string
  query: { channelId?: string; serverId?: string; conversationId?: string }
  name: string
  type: "channel" | "conversation"
  chatId: string
  currentMember: Member & { profile: Profile }
  onContentChange: (content: string) => void
  onSubmit: () => void
  isLoading: boolean
  clearTrigger?: number
}

function EditorUI({
  apiUrl,
  query,
  name,
  type,
  onSubmit,
  isLoading,
}: Omit<LexicalChatInputProps, "chatId" | "currentMember" | "onContentChange">) {
  const [editor] = useLexicalComposerContext()
  const { onOpen } = useModal()
  const [isEmpty, setIsEmpty] = useState(true)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot()
        const textContent = root.getTextContent()
        setIsEmpty(textContent.trim().length === 0)
      })
    })
  }, [editor])

  // Register Command+Enter to submit
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (!event) return false

        const isModifierPressed = event.metaKey || event.ctrlKey

        // Command/Ctrl + Enter to submit
        if (isModifierPressed) {
          event.preventDefault()
          if (!isEmpty && !isLoading) {
            onSubmit()
            return true
          }
        }
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, onSubmit, isEmpty, isLoading])


  const handleEmojiChange = useCallback(
    (emoji: string) => {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const textNode = $createTextNode(` ${emoji}`)
          $insertNodes([textNode])
        } else {
          const textNode = $createTextNode(` ${emoji}`)
          $insertNodes([textNode])
        }
      })
    },
    [editor],
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="absolute top-5.75 left-6 z-10">
            <Button
              variant="primary"
              size="icon"
              className="rounded-full bg-mana-600 hover:bg-mana-700"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent forceMount>
          <DropdownMenuItem onClick={() => onOpen("messageFile", { apiUrl, query })}>
            <Plus className="w-4 h-4" />
            <span>Add a File</span>
          </DropdownMenuItem>
          {type === "channel" && (
            <DropdownMenuItem onClick={() => onOpen("createPoll", { apiUrl, query })}>
              <BarChart3 className="w-4 h-4" />
              <span>Create a Poll</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>


      {/* Editor container and placeholder will be handled by RichTextPlugin */}
      <div className="relative" ref={editorContainerRef}>
        {/* Placeholder */}
        {isEmpty && (
          <div
            className={cn(
              "absolute top-3.5 left-14 pointer-events-none text-muted-foreground/70 z-0",
              type === "channel" && "left-15",
            )}
          >
            {`Message ${type === "conversation" ? name : "#" + name}`}
          </div>
        )}
      </div>

      <div className="absolute top-6 right-8 z-10 flex items-center gap-2">
        <EmojiPicker onChange={handleEmojiChange} />
        <Button
          type="button"
          size="icon"
          className="h-8 w-8 rounded-full bg-mana-600 hover:bg-mana-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onSubmit}
          disabled={isEmpty || isLoading}
          title="Send message (⌘+Enter or Ctrl+Enter)"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </>
  )
}

function ClearEditorPlugin({ clearTrigger }: { clearTrigger?: number }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger > 0) {
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        root.append($createParagraphNode())
      })
    }
  }, [editor, clearTrigger])

  return null
}

export function LexicalChatInput({
  apiUrl,
  query,
  name,
  type,
  chatId,
  currentMember,
  onContentChange,
  onSubmit,
  isLoading,
  clearTrigger,
}: LexicalChatInputProps) {
  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const root = $getRoot()

        function convertToMarkdown(node: typeof root): string {
          let result = ""
          const children = node.getChildren()

          for (const child of children) {
            if ($isMentionNode(child)) {
              const mentionType = child.getMentionType()
              const mentionName = child.getMentionName()
              const mentionId = child.getMentionId()
              const prefix = mentionType === "user" ? "@" : "#"
              // Include ID in format: @username[id] or #channelname[id]
              result += `${prefix}${mentionName}[${mentionId}]`
            } else if ($isTextNode(child)) {
              // Handle text formatting
              const text = child.getTextContent()
              const isBold = child.hasFormat("bold")
              const isItalic = child.hasFormat("italic")

              if (isBold && isItalic) {
                result += `***${text}***`
              } else if (isBold) {
                result += `**${text}**`
              } else if (isItalic) {
                result += `*${text}*`
              } else {
                result += text
              }
            } else if ($isLinkNode(child)) {
              const text = child.getTextContent()
              const url = child.getURL()
              result += `[${text}](${url})`
            } else if ($isParagraphNode(child)) {
              const paragraphContent = convertToMarkdown(child as unknown as typeof root)
              result += paragraphContent
            } else if ("getChildren" in child && typeof child.getChildren === "function") {
              result += convertToMarkdown(child as unknown as typeof root)
            } else {
              result += child.getTextContent()
            }
          }

          return result
        }

        const markdownContent = convertToMarkdown(root)
        onContentChange(markdownContent)
      })
    },
    [onContentChange],
  )

  const initialConfig = {
    namespace: "ChatInput",
    theme: chatEditorTheme,
    onError: (error: Error) => {
      console.error("[LEXICAL_ERROR]", error)
    },
    nodes: [MentionNode, LinkNode, ListNode, ListItemNode],
    editable: !isLoading,
  }

  return (
    <div className="border-t border-border px-4 py-4">
      <LexicalComposer initialConfig={initialConfig}>
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <LinkPlugin />
        <ListPlugin />
        <MarkdownShortcutsPlugin />
        <MentionsPlugin serverId={query.serverId} type={type} />
        <ClearEditorPlugin clearTrigger={clearTrigger} />
        <div className="relative p-4 pb-6">
          <EditorUI
            apiUrl={apiUrl}
            query={query}
            name={name}
            type={type}
            onSubmit={onSubmit}
            isLoading={isLoading}
          />
          <RichTextPlugin
            contentEditable={
              <div
                className={cn(
                  "relative min-h-[48px] max-h-[200px] overflow-y-auto",
                  "px-14 pr-15 py-3 bg-muted/50 font-medium rounded-md",
                  "text-foreground",
                  "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
                  type === "channel" && "pl-15",
                )}
              >
                <ContentEditable
                  className={cn(
                    "outline-none min-h-[24px]",
                    "chat-editor-root",
                  )}
                />
              </div>
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </LexicalComposer>
    </div>
  )
}
