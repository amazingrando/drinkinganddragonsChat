import { describe, it, expect } from '@jest/globals'

import {
  upsertPendingMessage,
  updateMessageStatus,
  OptimisticMessageParams,
} from '@/hooks/use-send-message-helpers'
import { ChatMessage } from '@/types'
import { createMockMember, createMockProfile } from '@/__tests__/utils/test-helpers'

const createParams = () => {
  const member = {
    ...createMockMember({ id: 'member-id' }),
    profile: createMockProfile({ id: 'profile-id' }),
  }

  const helperParams: OptimisticMessageParams = {
    query: { channelId: 'channel-1', serverId: 'server-1' },
    currentMember: member,
    type: 'channel',
  }

  return {
    helperParams,
    member,
  }
}

describe('chat message optimistic helpers', () => {
  it('creates a pending optimistic message when cache is empty', () => {
    const { helperParams, member } = createParams()

    const result = upsertPendingMessage(undefined, helperParams, { tempId: 'temp-1', content: 'Hello' })

    expect(result.pages).toBeDefined()
    expect(result.pages?.[0].items).toHaveLength(1)
    const optimistic = result.pages?.[0].items[0] as ChatMessage
    expect(optimistic.id).toBe('temp-1')
    expect(optimistic.optimisticId).toBe('temp-1')
    expect(optimistic.status).toBe('pending')
    expect(optimistic.memberId).toBe(member.id)
    expect(optimistic.content).toBe('Hello')
  })

  it('marks an existing message as pending when retrying', () => {
    const { helperParams, member } = createParams()

    const existing: ChatMessage = {
      id: 'temp-1',
      optimisticId: 'temp-1',
      status: 'failed',
      content: 'Hello',
      fileUrl: null,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channelId: 'channel-1',
      memberId: member.id,
      pollId: null,
      poll: null,
      member,
    }

    const result = upsertPendingMessage(
      {
        pages: [
          {
            items: [existing],
            nextCursor: null,
          },
        ],
        pageParams: [],
      },
      helperParams,
      { tempId: 'temp-1', content: 'Hello', isRetry: true },
    )

    expect(result.pages?.[0].items).toHaveLength(1)
    expect(result.pages?.[0].items[0].status).toBe('pending')
    expect(result.pages?.[0].items[0].id).toBe('temp-1')
  })

  it('updates message status using provided updater', () => {
    const { member } = createParams()

    const existing: ChatMessage = {
      id: 'temp-1',
      optimisticId: 'temp-1',
      status: 'pending',
      content: 'Hello',
      fileUrl: null,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channelId: 'channel-1',
      memberId: member.id,
      pollId: null,
      poll: null,
      member,
    }

    const result = updateMessageStatus(
      {
        pages: [
          {
            items: [existing],
            nextCursor: null,
          },
        ],
        pageParams: [],
      },
      'temp-1',
      (message) => ({
        ...message,
        status: 'failed',
      }),
    )

    expect(result?.pages?.[0].items[0].status).toBe('failed')
    expect(result?.pages?.[0].items[0].optimisticId).toBe('temp-1')
  })

  it('replaces optimistic message with server payload', () => {
    const { member } = createParams()

    const existing: ChatMessage = {
      id: 'temp-1',
      optimisticId: 'temp-1',
      status: 'pending',
      content: 'Hello',
      fileUrl: null,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channelId: 'channel-1',
      memberId: member.id,
      pollId: null,
      poll: null,
      member,
    }

    const serverPayload: ChatMessage = {
      ...existing,
      id: 'server-id',
      optimisticId: undefined,
      status: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const result = updateMessageStatus(
      {
        pages: [
          {
            items: [existing],
            nextCursor: null,
          },
        ],
        pageParams: [],
      },
      'temp-1',
      () => serverPayload,
    )

    const message = result?.pages?.[0].items[0]
    expect(message?.id).toBe('server-id')
    expect(message?.status).toBeUndefined()
    expect(message?.optimisticId).toBeUndefined()
  })
})
