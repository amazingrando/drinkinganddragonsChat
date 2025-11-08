"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Member, Profile } from "@prisma/client"
import ChatWelcome from "@/components/chat/chat-welcome"
import { useChatQuery } from "@/hooks/use-chat-query"
import { Loader2, ServerCrash } from "lucide-react"
import ChatItem from "@/components/chat/chat-item"
import ChatDaySeparator from "@/components/chat/chat-day-separator"
import { format, isSameDay } from "date-fns"
import { useChatRealtime } from "@/hooks/use-chat-realtime"
import { Button } from "../ui/button"
import { useChatScroll } from "@/hooks/use-chat-scroll"
import { ChatMessage } from "@/types"
import { useSendMessage } from "@/hooks/use-send-message"
import { ChatNewMessagesSeparator } from "@/components/chat/chat-new-messages-separator"
import { getUnreadBoundaryIndex } from "@/lib/chat/unread"

const DATE_FORMAT = "d MMM yyyy, HH:mm"
const DAY_SEPARATOR_FORMAT = "EEEE, MMMM d, yyyy"

interface ChatMessagesProps {
  name: string
  member: Member & { profile: Profile }
  chatId: string
  apiUrl: string
  socketUrl: string
  socketQuery: Record<string, string>
  paramKey: "channelId" | "conversationId"
  paramValue: string
  type: "channel" | "conversation"
  serverId?: string
  initialReadState?: {
    lastReadAt: string | Date | null
    lastMessageId: string | null
    hasUnread?: boolean
  }
}

const ChatMessages = ({
  name,
  member,
  chatId,
  apiUrl,
  socketUrl,
  socketQuery,
  paramKey,
  paramValue,
  type,
  serverId,
  initialReadState,
}: ChatMessagesProps) => {
  const queryKey = `chat:${chatId}`
  const addKey = `chat:${chatId}:messages`
  const updateKey = `chat:${chatId}:messages:update`

  const chatRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const newMessagesRef = useRef<HTMLDivElement>(null)
  const persistRef = useRef(false)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const notifiedRef = useRef<boolean>(false)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useChatQuery({
    queryKey,
    apiUrl: apiUrl,
    paramKey: paramKey,
    paramValue: paramValue,
  })

  const { sendMessage: retrySendMessage, isSending: isRetrying, pendingTempId } = useSendMessage({
    apiUrl: socketUrl,
    query: socketQuery,
    queryKey,
    currentMember: member,
    type,
  })

  const handleRetry = useCallback(
    (message: ChatMessage) => {
      void retrySendMessage(message.content, { tempId: message.id, isRetry: true })
    },
    [retrySendMessage],
  )

  // Use Supabase Realtime for all chat types
  useChatRealtime({
    addKey: addKey,
    updateKey: updateKey,
    queryKey: queryKey
  })

  const enableUnreadTracking = type === "channel"

  const [lastReadAt, setLastReadAt] = useState<Date | null>(() => {
    const value = initialReadState?.lastReadAt
    if (!value) {
      return null
    }
    return value instanceof Date ? value : new Date(value)
  })

  const allMessages = useMemo<ChatMessage[]>(() => {
    const seenIds = new Set<string>()
    const flattened: ChatMessage[] = []
    data?.pages?.forEach((group) => {
      group.items.forEach((message: ChatMessage) => {
        if (!seenIds.has(message.id)) {
          seenIds.add(message.id)
          flattened.push(message)
        }
      })
    })
    return flattened
  }, [data])

  const unreadBoundaryIndex = useMemo(() => {
    if (!enableUnreadTracking) {
      return -1
    }
    return getUnreadBoundaryIndex(allMessages, lastReadAt)
  }, [allMessages, enableUnreadTracking, lastReadAt])

  const showUnreadSeparator = enableUnreadTracking && !isAtBottom && unreadBoundaryIndex >= 0

  const latestMessage = allMessages[0]

  const markMessagesAsRead = useCallback(
    async (message?: ChatMessage) => {
      if (!enableUnreadTracking || !serverId || persistRef.current) {
        return
      }

      const target = message ?? latestMessage
      if (!target) {
        return
      }

      const createdAt = new Date(target.createdAt || Date.now())
      if (lastReadAt && createdAt <= lastReadAt) {
        return
      }

      persistRef.current = true
      setLastReadAt(createdAt)

      try {
        await fetch(`/api/channels/${paramValue}/read?serverId=${serverId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lastMessageId: target.id,
            lastReadAt: createdAt.toISOString(),
          }),
        })
      } catch (error) {
        console.error("[CHAT_MARK_READ]", error)
      } finally {
        persistRef.current = false
      }
    },
    [enableUnreadTracking, lastReadAt, latestMessage, paramValue, serverId],
  )

  useEffect(() => {
    if (!showUnreadSeparator || !newMessagesRef.current) {
      return
    }

    const node = newMessagesRef.current
    node.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [showUnreadSeparator])

  useEffect(() => {
    if (!showUnreadSeparator) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void markMessagesAsRead()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [markMessagesAsRead, showUnreadSeparator])

  useEffect(() => {
    if (!enableUnreadTracking || !initialReadState?.hasUnread || notifiedRef.current) {
      return
    }

    notifiedRef.current = true

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("guildhall:new-messages", {
          detail: {
            channelId: paramValue,
            serverId,
            hasUnread: true,
          },
        }),
      )
    }

    if (initialReadState.lastReadAt) {
      const createdAt = new Date(initialReadState.lastReadAt)
      if (!Number.isNaN(createdAt.getTime())) {
        setLastReadAt(createdAt)
      }
    }
  }, [enableUnreadTracking, initialReadState, paramValue, serverId])

  useChatScroll({
    chatRef: chatRef as React.RefObject<HTMLDivElement>,
    bottomRef: bottomRef as React.RefObject<HTMLDivElement>,
    loadMore: fetchNextPage,
    shouldLoadMore: !isFetchingNextPage && !!hasNextPage,
    count: data?.pages?.[0]?.items.length || 0,
    disableInitialScroll: enableUnreadTracking && ((initialReadState?.hasUnread ?? false) || showUnreadSeparator),
    autoScrollEnabled: !showUnreadSeparator,
    onAtBottomChange: (atBottom) => {
      setIsAtBottom(atBottom)
      if (atBottom) {
        void markMessagesAsRead()
      }
    },
  })

  useEffect(() => {
    if (!enableUnreadTracking || !isAtBottom || !latestMessage) {
      return
    }

    const createdAt = new Date(latestMessage.createdAt || Date.now())
    if (lastReadAt && createdAt <= lastReadAt) {
      return
    }

    void markMessagesAsRead(latestMessage)
  }, [enableUnreadTracking, isAtBottom, latestMessage, lastReadAt, markMessagesAsRead])

  if (status === "pending") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <Loader2 className="w-6 h-6 text-icon-foreground animate-spin" />
        <p className="text-sm text-foreground">Loading messages...</p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <ServerCrash className="w-6 h-6 text-icon-foreground" />
        <p className="text-sm text-foreground">Something went wrong!</p>
      </div>
    )
  }

  return (
    <div ref={chatRef} className="flex-1 flex flex-col py-4 overflow-y-auto ">
      <div className="flex-1" />
      {!hasNextPage && (
        <div className="flex-1" />
      )}
      {!hasNextPage && (
        <ChatWelcome type={type} name={name} />
      )}
      {hasNextPage && (
        <div className="flex justify-center">
          {isFetchingNextPage ?
            <Loader2 className="w-4 h-4 animate-spin text-icon-foreground" /> :
            <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              <Loader2 className="w-4 h-4 animate-spin text-foreground" />
              Load more
            </Button>
          }
        </div>
      )}
      <div className="flex flex-col-reverse mt-auto">
        {(() => {
          const messageNodes: React.ReactNode[] = []

          allMessages.forEach((message, index) => {
            const createdAt = new Date(message.createdAt || Date.now())
            const nextMessage = allMessages[index + 1]
            const nextCreatedAt = nextMessage ? new Date(nextMessage.createdAt || Date.now()) : null
            const showDaySeparator = !nextMessage || !nextCreatedAt || !isSameDay(createdAt, nextCreatedAt)
            const isUnreadBoundary = showUnreadSeparator && index === unreadBoundaryIndex

            messageNodes.push(
              <ChatItem
                key={message.id}
                id={message.id}
                currentMember={member}
                member={message.member}
                content={message.content}
                fileUrl={message.fileUrl}
                deleted={message.deleted}
                timestamp={format(createdAt, DATE_FORMAT)}
                isUpdated={message.updatedAt !== message.createdAt}
                socketUrl={socketUrl}
                socketQuery={socketQuery}
                poll={"poll" in message ? message.poll : undefined}
                status={message.status}
                isRetrying={isRetrying && pendingTempId === message.id}
                onRetry={message.status === "failed" ? () => handleRetry(message) : undefined}
              />
            )

            if (isUnreadBoundary) {
              messageNodes.push(
                <ChatNewMessagesSeparator
                  key={`new-messages-${message.id}`}
                  ref={newMessagesRef}
                />
              )
            }

            if (showDaySeparator) {
              messageNodes.push(
                <ChatDaySeparator
                  key={`separator-${message.id}`}
                  label={format(createdAt, DAY_SEPARATOR_FORMAT)}
                />
              )
            }
          })

          return messageNodes
        })()}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}

export default ChatMessages