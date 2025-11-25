"use client"

import { useState, useCallback } from "react"
import { Member, Profile } from "@prisma/client"
import { useSendMessage } from "@/hooks/use-send-message"
import { LexicalChatInput } from "./lexical-chat-input"
interface ChatInputProps {
  apiUrl: string
  query: { channelId?: string; serverId?: string; conversationId?: string }
  name: string
  type: "channel" | "conversation"
  chatId: string
  currentMember: Member & { profile: Profile }
}

export const ChatInput = ({ apiUrl, query, name, type, chatId, currentMember }: ChatInputProps) => {
  const queryKey = `chat:${chatId}`
  const { sendMessage, isSending } = useSendMessage({
    apiUrl,
    query,
    queryKey,
    currentMember,
    type,
  })

  const [content, setContent] = useState("")
  const [clearTrigger, setClearTrigger] = useState(0)

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
  }, [])

  const handleSubmit = useCallback(async () => {
    try {
      const trimmedContent = content.trim()
      if (!trimmedContent) {
        return
      }

      await sendMessage(trimmedContent)
      setContent("")
      setClearTrigger((prev) => prev + 1)
    } catch (error) {
      console.error(error)
    }
  }, [content, sendMessage])

  const isLoading = isSending

  return (
    <LexicalChatInput
      apiUrl={apiUrl}
      query={query}
      name={name}
      type={type}
      chatId={chatId}
      currentMember={currentMember}
      onContentChange={handleContentChange}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      clearTrigger={clearTrigger}
    />
  )
}

export default ChatInput
