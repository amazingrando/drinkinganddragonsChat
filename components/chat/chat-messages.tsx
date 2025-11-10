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
    unreadCount?: number
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
  const persistRef = useRef(false)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const notifiedRef = useRef<boolean>(false)
  const markTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasScrolledToUnreadRef = useRef(false)
  const hasScrolledToLastReadRef = useRef(false)
  const latestUnreadObservedIdRef = useRef<string | null>(null)
  const shouldDeferReadRef = useRef(false)

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
  const hasInitialUnread = initialReadState?.hasUnread ?? false
  const initialLastMessageId = initialReadState?.lastMessageId ?? null

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

  const showUnreadSeparator = enableUnreadTracking && unreadBoundaryIndex >= 0
  const shouldDisableInitialScroll = enableUnreadTracking && (
    showUnreadSeparator ||
    hasInitialUnread ||
    (initialLastMessageId !== null && !hasInitialUnread)
  )
  const firstUnreadMessageId = showUnreadSeparator ? allMessages[unreadBoundaryIndex]?.id : undefined

  const latestUnreadMessageId = useMemo(() => {
    if (!enableUnreadTracking || !allMessages.length) {
      return undefined
    }

    if (!lastReadAt) {
      return allMessages[0]?.id
    }

    const latestUnread = allMessages.find((message) => {
      const createdAt = new Date(message.createdAt || Date.now())
      return createdAt > lastReadAt
    })

    return latestUnread?.id
  }, [allMessages, enableUnreadTracking, lastReadAt])

  const latestMessage = allMessages[0]

  const clearPendingMark = useCallback(() => {
    if (markTimeoutRef.current) {
      clearTimeout(markTimeoutRef.current)
      markTimeoutRef.current = null
    }
  }, [])

  const runImmediateMark = useCallback(
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

  const scheduleDelayedMark = useCallback(
    (message?: ChatMessage) => {
      if (markTimeoutRef.current) {
        return
      }
      markTimeoutRef.current = setTimeout(() => {
        markTimeoutRef.current = null
        void runImmediateMark(message)
      }, 60_000)
    },
    [runImmediateMark],
  )

  const markMessagesAsRead = useCallback(
    async (message?: ChatMessage, options?: { immediate?: boolean; force?: boolean }) => {
      const immediate = options?.immediate ?? true
      const force = options?.force ?? false

      if (force) {
        shouldDeferReadRef.current = false
      }

      if (!force && shouldDeferReadRef.current) {
        return
      }

      if (!immediate) {
        scheduleDelayedMark(message)
        return
      }

      clearPendingMark()
      await runImmediateMark(message)
    },
    [clearPendingMark, runImmediateMark, scheduleDelayedMark],
  )

  useEffect(() => {
    if (
      !enableUnreadTracking ||
      !showUnreadSeparator ||
      !firstUnreadMessageId ||
      hasScrolledToUnreadRef.current
    ) {
      return
    }

    const container = chatRef.current
    const target = container?.querySelector<HTMLElement>(`[data-chat-item-id="${firstUnreadMessageId}"]`)
    const latestElement = container?.querySelector<HTMLElement>(`[data-chat-item-id="${allMessages[0]?.id}"]`)

    if (!target) {
      return
    }

    hasScrolledToUnreadRef.current = true
    target.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" })

    if (container && latestElement) {
      const containerRect = container.getBoundingClientRect()
      const latestRect = latestElement.getBoundingClientRect()
      const latestVisible = latestRect.bottom > containerRect.top && latestRect.top < containerRect.bottom

      if (latestVisible) {
        shouldDeferReadRef.current = true
      }
    }
  }, [allMessages, enableUnreadTracking, firstUnreadMessageId, showUnreadSeparator])

  useEffect(() => {
    if (
      !enableUnreadTracking ||
      showUnreadSeparator ||
      hasInitialUnread ||
      hasScrolledToLastReadRef.current ||
      !initialLastMessageId
    ) {
      return
    }

    const container = chatRef.current
    if (!container) {
      return
    }

    const target = container.querySelector<HTMLElement>(`[data-chat-item-id="${initialLastMessageId}"]`)
    if (!target) {
      return
    }

    hasScrolledToLastReadRef.current = true
    target.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" })
  }, [
    allMessages,
    enableUnreadTracking,
    hasInitialUnread,
    initialLastMessageId,
    showUnreadSeparator,
  ])

  useEffect(() => {
    if (!enableUnreadTracking || !latestUnreadMessageId) {
      if (!latestUnreadMessageId) {
        latestUnreadObservedIdRef.current = null
        shouldDeferReadRef.current = false
      }
      return
    }

    if (latestUnreadObservedIdRef.current === latestUnreadMessageId) {
      return
    }

    const container = chatRef.current
    if (!container) {
      return
    }

    const target = container.querySelector<HTMLElement>(`[data-chat-item-id="${latestUnreadMessageId}"]`)
    if (!target) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.find((entry) => entry.isIntersecting)
        if (!intersecting) {
          return
        }

        if (shouldDeferReadRef.current) {
          return
        }

        latestUnreadObservedIdRef.current = latestUnreadMessageId
        observer.disconnect()
        void markMessagesAsRead(undefined, { immediate: true })
      },
      {
        root: container,
        threshold: 0.75,
      },
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [enableUnreadTracking, latestUnreadMessageId, markMessagesAsRead])

  useEffect(() => {
    if (!showUnreadSeparator) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void markMessagesAsRead(undefined, { immediate: true, force: true })
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
    const initialUnreadCount = Math.max(0, initialReadState?.unreadCount ?? 0)

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("guildhall:new-messages", {
          detail: {
            channelId: paramValue,
            serverId,
            hasUnread: initialUnreadCount > 0,
            unreadCount: initialUnreadCount,
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

  const enableUnreadTrackingRef = useRef(enableUnreadTracking)
  useEffect(() => {
    enableUnreadTrackingRef.current = enableUnreadTracking
  }, [enableUnreadTracking])

  const markMessagesAsReadRef = useRef(markMessagesAsRead)
  useEffect(() => {
    markMessagesAsReadRef.current = markMessagesAsRead
  }, [markMessagesAsRead])

  useEffect(() => {
    return () => {
      clearPendingMark()
      if (!enableUnreadTrackingRef.current) {
        return
      }

      const mark = markMessagesAsReadRef.current
      if (!mark) {
        return
      }

      void mark(undefined, { immediate: true, force: true })
    }
  }, [clearPendingMark])

  useEffect(() => {
    const container = chatRef.current
    if (!container) {
      return
    }

    const handleScroll = () => {
      if (!shouldDeferReadRef.current) {
        return
      }

      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      if (distanceFromBottom >= 400) {
        shouldDeferReadRef.current = false
        void markMessagesAsRead(undefined, { immediate: true, force: true })
      }
    }

    container.addEventListener("scroll", handleScroll)
    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [markMessagesAsRead])

  const handleAtBottomChange = useCallback(
    (atBottom: boolean) => {
      setIsAtBottom(atBottom)
      if (atBottom) {
        void markMessagesAsRead(undefined, { immediate: false })
      } else {
        clearPendingMark()
      }
    },
    [clearPendingMark, markMessagesAsRead],
  )

  useChatScroll({
    chatRef: chatRef as React.RefObject<HTMLDivElement>,
    bottomRef: bottomRef as React.RefObject<HTMLDivElement>,
    loadMore: fetchNextPage,
    shouldLoadMore: !isFetchingNextPage && !!hasNextPage,
    count: data?.pages?.[0]?.items.length || 0,
    disableInitialScroll: shouldDisableInitialScroll,
    autoScrollEnabled: !showUnreadSeparator,
    onAtBottomChange: handleAtBottomChange,
  })

  useEffect(() => {
    if (!enableUnreadTracking || !isAtBottom || !latestMessage) {
      return
    }

    const createdAt = new Date(latestMessage.createdAt || Date.now())
    if (lastReadAt && createdAt <= lastReadAt) {
      return
    }

    void markMessagesAsRead(latestMessage, { immediate: false })
  }, [enableUnreadTracking, isAtBottom, latestMessage, lastReadAt, markMessagesAsRead])

  useEffect(() => {
    if (!enableUnreadTracking || !latestMessage || !serverId) {
      return
    }

    const authorId = latestMessage.member?.id ?? latestMessage.memberId
    if (authorId !== member.id) {
      return
    }

    const createdAt = new Date(latestMessage.createdAt || Date.now())
    if (Number.isNaN(createdAt.getTime())) {
      return
    }

    if (lastReadAt && createdAt <= lastReadAt) {
      return
    }

    void markMessagesAsRead(latestMessage, { immediate: true, force: true })
  }, [enableUnreadTracking, lastReadAt, latestMessage, markMessagesAsRead, member.id, serverId])

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
            const isUnread = enableUnreadTracking && (!lastReadAt || createdAt > lastReadAt)

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
                isUnread={isUnread}
              />
            )

            if (isUnreadBoundary) {
              messageNodes.push(
                <ChatNewMessagesSeparator
                  key={`new-messages-${message.id}`}
                  onMarkAsRead={() => {
                    void markMessagesAsRead(undefined, { immediate: true, force: true })
                  }}
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