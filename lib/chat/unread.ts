import { ChatMessage } from "@/types"

const asDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value
  }

  const parsed = typeof value === "string" || typeof value === "number" ? new Date(value) : new Date()
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export const getUnreadBoundaryIndex = (messages: ChatMessage[], lastReadAt: Date | null): number => {
  if (!messages.length) {
    return -1
  }

  if (!lastReadAt) {
    return messages.length - 1
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (!message) {
      continue
    }
    const createdAt = asDate(message.createdAt)
    if (createdAt <= lastReadAt) {
      continue
    }

    const nextMessage = messages[index + 1]
    if (!nextMessage) {
      return index
    }

    const nextCreatedAt = asDate(nextMessage.createdAt)
    if (nextCreatedAt <= lastReadAt) {
      return index
    }
  }

  return -1
}

export const hasUnreadMessages = (messages: ChatMessage[], lastReadAt: Date | null): boolean => {
  return getUnreadBoundaryIndex(messages, lastReadAt) >= 0
}

