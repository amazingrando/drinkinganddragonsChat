"use client"

import React, { useEffect, useRef } from "react"
import { Member, Message, Profile } from "@prisma/client"
import ChatWelcome from "@/components/chat/chat-welcome"
import { useChatQuery } from "@/hooks/use-chat-query"
import { Loader2, ServerCrash } from "lucide-react"
import ChatItem from "@/components/chat/chat-item"
import { format } from "date-fns"
import { useChatSocket } from "@/hooks/use-chat-socket"
import { Button } from "../ui/button"
import { useChatScroll } from "@/hooks/use-chat-scroll"

const DATE_FORMAT = "d MMM yyyy, HH:mm"

interface ChatMessagesProps {
  name: string
  member: Member
  chatId: string
  apiUrl: string
  socketUrl: string
  socketQuery: Record<string, string>
  paramKey: "channelId" | "conversationId"
  paramValue: string
  type: "channel" | "conversation"
}

type MessageWithMemberWithProfile = Message & { member: Member & { profile: Profile } }

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

  useChatSocket({
    addKey: addKey,
    updateKey: updateKey,
    queryKey: socketQuery
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
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        <p className="text-sm text-zinc-500">Loading messages...</p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <ServerCrash className="w-6 h-6 text-zinc-500" />
        <p className="text-sm text-zinc-500">Something went wrong!</p>
      </div>
    )
  }

  return (
    <div ref={chatRef} className="flex-1 flex flex-col py-4 overflow-y-auto">
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
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" /> :
            <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
              Load more
            </Button>
          }
        </div>
      )}
      <div className="flex flex-col-reverse mt-auto">
        {data?.pages?.map((group, i) => (
          <React.Fragment key={i}>
            {group.items.map((message: MessageWithMemberWithProfile) => (
              <ChatItem
                key={message.id}
                id={message.id}
                currentMember={member}
                member={message.member}
                content={message.content}
                fileUrl={message.fileUrl}
                deleted={message.deleted}
                timestamp={format(new Date(message.createdAt), DATE_FORMAT)}
                isUpdated={message.updatedAt !== message.createdAt}
                socketUrl={socketUrl}
                socketQuery={socketQuery}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}

export default ChatMessages