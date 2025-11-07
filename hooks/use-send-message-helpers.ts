import { Member, Profile } from "@prisma/client"

import { ChatMessage } from "@/types"

export type OptimisticMessageParams = {
  query: Record<string, string | undefined>
  currentMember: Member & { profile: Profile }
  type: "channel" | "conversation"
}

export type SendMessageVariables = {
  tempId: string
  content: string
  isRetry?: boolean
}

export type InfiniteChatData = {
  pages: Array<{ items: ChatMessage[]; nextCursor?: string | null }>
  pageParams?: unknown[]
}

export const createOptimisticMessage = (
  params: OptimisticMessageParams,
  variables: SendMessageVariables,
): ChatMessage => {
  const { currentMember, query, type } = params
  const { tempId, content } = variables
  const timestamp = new Date()

  if (type === "channel") {
    return {
      id: tempId,
      optimisticId: tempId,
      content,
      fileUrl: null,
      deleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      channelId: query.channelId ?? "",
      memberId: currentMember.id,
      pollId: null,
      poll: null,
      member: currentMember,
      status: "pending" as ChatMessage["status"],
    } as ChatMessage
  }

  return {
    id: tempId,
    optimisticId: tempId,
    content,
    fileUrl: null,
    deleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    conversationId: query.conversationId ?? "",
    memberId: currentMember.id,
    member: currentMember,
    status: "pending" as ChatMessage["status"],
  } as ChatMessage
}

const normalizeData = (data: InfiniteChatData | undefined): InfiniteChatData => {
  if (data && Array.isArray(data.pages)) {
    return data
  }

  return {
    pages: [],
    pageParams: [],
  }
}

export const upsertPendingMessage = (
  data: InfiniteChatData | undefined,
  params: OptimisticMessageParams,
  variables: SendMessageVariables,
): InfiniteChatData => {
  const base = normalizeData(data)
  const { isRetry, tempId } = variables

  if (isRetry) {
    const updatedPages = base.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => {
        if (item.id === tempId || item.optimisticId === tempId) {
          return {
            ...item,
            status: "pending" as ChatMessage["status"],
          }
        }
        return item
      }),
    }))

    return {
      ...base,
      pages: updatedPages,
    }
  }

  const optimisticMessage = createOptimisticMessage(params, variables)

  if (!base.pages.length) {
    return {
      ...base,
      pages: [
        {
          items: [optimisticMessage],
          nextCursor: null,
        },
      ],
    }
  }

  const [firstPage, ...rest] = base.pages

  return {
    ...base,
    pages: [
      {
        ...firstPage,
        items: [optimisticMessage, ...firstPage.items],
      },
      ...rest,
    ],
  }
}

export const updateMessageStatus = (
  data: InfiniteChatData | undefined,
  tempId: string,
  updater: (message: ChatMessage) => ChatMessage,
): InfiniteChatData | undefined => {
  if (!data || !Array.isArray(data.pages)) {
    return data
  }

  const updatedPages = data.pages.map((page) => ({
    ...page,
    items: page.items.map((item) => {
      if (item.id === tempId || item.optimisticId === tempId) {
        return updater(item)
      }
      return item
    }),
  }))

  return {
    ...data,
    pages: updatedPages,
  }
}
