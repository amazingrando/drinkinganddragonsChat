"use client"

import React, { useCallback, useRef } from "react"
import { Member, Profile } from "@prisma/client"
import ChatWelcome from "@/components/chat/chat-welcome"
import { useChatQuery } from "@/hooks/use-chat-query"
import { Loader2, ServerCrash } from "lucide-react"
import ChatItem from "@/components/chat/chat-item"
import { format } from "date-fns"
import { useChatRealtime } from "@/hooks/use-chat-realtime"
import { Button } from "../ui/button"
import { useChatScroll } from "@/hooks/use-chat-scroll"
import { ChatMessage } from "@/types"
import { useSendMessage } from "@/hooks/use-send-message"

const DATE_FORMAT = "d MMM yyyy, HH:mm"

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
}

const ChatMessages = ({ name, member, chatId, apiUrl, socketUrl, socketQuery, paramKey, paramValue, type }: ChatMessagesProps) => {
  const queryKey = `chat:${chatId}`
  const addKey = `chat:${chatId}:messages`
  const updateKey = `chat:${chatId}:messages:update`

  const chatRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

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

  useChatScroll({
    chatRef: chatRef as React.RefObject<HTMLDivElement>,
    bottomRef: bottomRef as React.RefObject<HTMLDivElement>,
    loadMore: fetchNextPage,
    shouldLoadMore: !isFetchingNextPage && !!hasNextPage,
    count: data?.pages?.[0]?.items.length || 0,
  })

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
          // Flatten and deduplicate messages from all pages, preserving order
          const seenIds = new Set<string>();
          const allMessages: ChatMessage[] = [];

          // Iterate through pages in reverse to maintain correct order when flattened
          // (since flex-col-reverse will reverse the visual order)
          data?.pages?.forEach((group) => {
            // Iterate items in the order they appear in the page
            group.items.forEach((message: ChatMessage) => {
              if (!seenIds.has(message.id)) {
                seenIds.add(message.id);
                allMessages.push(message);
              }
            });
          });

          return allMessages.map((message) => (
            <ChatItem
              key={message.id}
              id={message.id}
              currentMember={member}
              member={message.member}
              content={message.content}
              fileUrl={message.fileUrl}
              deleted={message.deleted}
              timestamp={format(new Date(message.createdAt || Date.now()), DATE_FORMAT)}
              isUpdated={message.updatedAt !== message.createdAt}
              socketUrl={socketUrl}
              socketQuery={socketQuery}
              poll={"poll" in message ? message.poll : undefined}
              status={message.status}
              isRetrying={isRetrying && pendingTempId === message.id}
              onRetry={message.status === "failed" ? () => handleRetry(message) : undefined}
            />
          ));
        })()}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}

export default ChatMessages