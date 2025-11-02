import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { PATCH } from '@/app/api/polls/[pollId]/close/route'
import { db } from '@/lib/db'
import { currentProfile } from '@/lib/current-profile'
import { broadcastMessage } from '@/lib/supabase/server-broadcast'
import {
  createMockProfile,
  createMockMember,
  createMockServerWithMembers,
  createMockPollWithOptions,
  createMockPollWithVotes,
  createMockMessageWithPoll,
  createMockNextRequest,
  parseNextResponse,
} from '@/__tests__/utils/test-helpers'

const mockDb = db as any
const mockCurrentProfile = currentProfile as any
const mockBroadcastMessage = broadcastMessage as any

describe('PATCH /api/polls/[pollId]/close - Close Poll', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('closes poll successfully', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const mockPoll = createMockPollWithOptions({ creatorId: 'member-id-1' })
    const closedPoll = createMockPollWithOptions({
      closedAt: new Date(),
    })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll as any)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)
    mockDb.poll.update.mockResolvedValue(closedPoll as any)
    mockDb.poll.findUnique.mockResolvedValueOnce(closedPoll as any)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll() as any)

    const request = createMockNextRequest({}, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(mockDb.poll.update).toHaveBeenCalledWith({
      where: { id: 'poll-id-1' },
      data: { closedAt: expect.any(Date) },
    })
    expect(mockBroadcastMessage).toHaveBeenCalled()
  })

  it('only allows creator to close poll', async () => {
    // Arrange
    const mockProfile = createMockProfile({ id: 'other-profile-id' })
    const mockServer = createMockServerWithMembers({
      members: [
        createMockMember({ id: 'member-id-1', role: 'ADMIN' as const, profileID: 'profile-id-1' }),
        createMockMember({ id: 'member-id-2', role: 'MEMBER' as const, profileID: 'other-profile-id' }),
      ],
    })
    const mockPoll = createMockPollWithOptions({ creatorId: 'member-id-1' })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll as any)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)

    const request = createMockNextRequest({}, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(403)
    expect(result.data.message).toContain('Only the poll creator can close the poll')
  })

  it('prevents closing already closed poll', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const mockPoll = createMockPollWithOptions({
      creatorId: 'member-id-1',
      closedAt: new Date(),
    })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValue(mockPoll as any)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)

    const request = createMockNextRequest({}, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(400)
    expect(result.data.message).toContain('Poll is already closed')
  })

  it('returns 401 for unauthorized users', async () => {
    // Arrange
    mockCurrentProfile.mockResolvedValue(null)

    const request = createMockNextRequest({}, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(401)
    expect(result.data.message).toBe('Unauthorized')
  })

  it('returns 404 for non-existent poll', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValue(null)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)

    const request = createMockNextRequest({}, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'invalid-poll-id' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(404)
    expect(result.data.message).toBe('Poll not found')
  })

  it('broadcasts poll close event', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const mockPoll = createMockPollWithOptions({ creatorId: 'member-id-1' })
    const closedPoll = createMockPollWithOptions({
      closedAt: new Date(),
    })
    const mockMessage = createMockMessageWithPoll()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll as any)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)
    mockDb.poll.update.mockResolvedValue(closedPoll as any)
    mockDb.poll.findUnique.mockResolvedValueOnce(closedPoll as any)
    mockDb.message.findUnique.mockResolvedValue(mockMessage as any)

    const request = createMockNextRequest({}, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(mockBroadcastMessage).toHaveBeenCalledWith(
      'poll:poll-id-1:close',
      'poll:poll-id-1:close',
      expect.any(Object)
    )
  })
})
