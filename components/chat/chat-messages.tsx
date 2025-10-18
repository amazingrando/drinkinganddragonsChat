"use client"

import { Member, Message, Profile } from "@prisma/client"
import ChatWelcome from "@/components/chat/chat-welcome"
import { useChatQuery } from "@/hooks/use-chat-query"
import { Loader2, ServerCrash } from "lucide-react"
import { Avatar, AvatarImage } from "@radix-ui/react-avatar"
import React from "react"

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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useChatQuery({
    queryKey,
    apiUrl: apiUrl,
    paramKey: paramKey,
    paramValue: paramValue,
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
    <div className="flex-1 flex flex-col py-4 overflow-y-auto">
      <div className="flex-1" />
      <ChatWelcome type={type} name={name} />
      <div className="flex flex-col-reverse mt-auto">
        {data?.pages?.map((group, i) => (
          <React.Fragment key={i}>
            {group.items.map((message: MessageWithMemberWithProfile) => (
              <div key={message.id}>
                {message.content}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

export default ChatMessages