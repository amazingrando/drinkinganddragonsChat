import { describe, expect, it } from "@jest/globals"

import { getUnreadBoundaryIndex, hasUnreadMessages } from "@/lib/chat/unread"
import { ChatMessage } from "@/types"
import { createMockMember, createMockProfile } from "@/__tests__/utils/test-helpers"

const createMessage = (overrides: Partial<ChatMessage> & { createdAt: Date | string }): ChatMessage => {
  const member = {
    ...createMockMember({ id: overrides.memberId ?? "member-id" }),
    profile: createMockProfile({ id: "profile-id" }),
  }

  return {
    id: overrides.id ?? `msg-${Math.random().toString(36).slice(2)}`,
    content: overrides.content ?? "test message",
    fileUrl: null,
    deleted: false,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    channelId: overrides.channelId ?? "channel-id",
    memberId: overrides.memberId ?? "member-id",
    pollId: null,
    poll: null,
    member,
    status: overrides.status,
    optimisticId: overrides.optimisticId,
  }
}

describe("chat unread helpers", () => {
  it("returns -1 when there are no messages", () => {
    expect(getUnreadBoundaryIndex([], new Date())).toBe(-1)
    expect(hasUnreadMessages([], new Date())).toBe(false)
  })

  it("treats all messages as unread when lastReadAt is null", () => {
    const now = new Date()
    const messages: ChatMessage[] = [
      createMessage({ id: "a", createdAt: now }),
      createMessage({ id: "b", createdAt: new Date(now.getTime() - 1000) }),
    ]

    expect(getUnreadBoundaryIndex(messages, null)).toBe(messages.length - 1)
    expect(hasUnreadMessages(messages, null)).toBe(true)
  })

  it("identifies boundary when only newest message is unread", () => {
    const now = new Date()
    const messages: ChatMessage[] = [
      createMessage({ id: "latest", createdAt: now }),
      createMessage({ id: "older", createdAt: new Date(now.getTime() - 10_000) }),
    ]

    const lastReadAt = new Date(now.getTime() - 1000)

    expect(getUnreadBoundaryIndex(messages, lastReadAt)).toBe(0)
  })

  it("identifies boundary when multiple unread messages exist", () => {
    const now = new Date()
    const messages: ChatMessage[] = [
      createMessage({ id: "msg-1", createdAt: now }),
      createMessage({ id: "msg-2", createdAt: new Date(now.getTime() - 1000) }),
      createMessage({ id: "msg-3", createdAt: new Date(now.getTime() - 2000) }),
      createMessage({ id: "msg-4", createdAt: new Date(now.getTime() - 10_000) }),
    ]

    const lastReadAt = new Date(now.getTime() - 5_000)

    expect(getUnreadBoundaryIndex(messages, lastReadAt)).toBe(2)
  })

  it("returns -1 when all messages are before lastReadAt", () => {
    const now = new Date()
    const messages: ChatMessage[] = [
      createMessage({ id: "msg-1", createdAt: new Date(now.getTime() - 10_000) }),
      createMessage({ id: "msg-2", createdAt: new Date(now.getTime() - 20_000) }),
    ]

    const lastReadAt = new Date(now.getTime() - 5_000)

    expect(getUnreadBoundaryIndex(messages, lastReadAt)).toBe(-1)
    expect(hasUnreadMessages(messages, lastReadAt)).toBe(false)
  })
})

