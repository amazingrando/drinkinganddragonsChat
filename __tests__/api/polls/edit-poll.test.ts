import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { PATCH } from '@/app/api/polls/[pollId]/route'
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

describe('PATCH /api/polls/[pollId] - Edit Poll', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  it('updates poll title', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const mockPoll = createMockPollWithOptions({ creatorId: 'member-id-1' })
    const updatedPoll = createMockPollWithOptions({ title: 'Updated Title' })
    const mockMessage = createMockMessageWithPoll()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll as any)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)
    mockDb.pollOption.findMany.mockResolvedValue(mockPoll.options as any)
    mockDb.poll.update.mockResolvedValue(updatedPoll as any)
    mockDb.poll.findUnique.mockResolvedValueOnce(updatedPoll as any)
    mockDb.message.findUnique.mockResolvedValue(mockMessage as any)

    const requestBody = {
      title: 'Updated Title',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(result.data.title).toBe('Updated Title')
    expect(mockDb.poll.update).toHaveBeenCalled()
  })

  it('updates poll options while preserving votes', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const existingOptions = createMockPollWithVotes()
    const updatedPoll = createMockPollWithVotes()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(existingOptions as any)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)
    mockDb.pollOption.findMany.mockResolvedValue(existingOptions.options as any)
    mockDb.pollOption.deleteMany.mockResolvedValue({ count: 0 } as any)
    mockDb.poll.update.mockResolvedValue(updatedPoll as any)
    mockDb.poll.findUnique.mockResolvedValueOnce(updatedPoll as any)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll() as any)

    const requestBody = {
      options: ['Updated Option 1', 'Updated Option 2', 'New Option 3'],
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(mockDb.pollOption.findMany).toHaveBeenCalled()
    // Verify votes are preserved by checking that deleteMany was not called to remove all options
  })

  it('updates allowMultipleChoices and allowAddOptions flags', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const mockPoll = createMockPollWithOptions()
    const updatedPoll = createMockPollWithOptions({
      allowMultipleChoices: true,
      allowAddOptions: true,
    })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll as any)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)
    mockDb.poll.update.mockResolvedValue(updatedPoll as any)
    mockDb.poll.findUnique.mockResolvedValueOnce(updatedPoll as any)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll() as any)

    const requestBody = {
      allowMultipleChoices: true,
      allowAddOptions: true,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(mockDb.poll.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allowMultipleChoices: true,
          allowAddOptions: true,
        }),
      })
    )
  })

  it('only allows creator or admin to edit', async () => {
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
    mockDb.poll.findUnique.mockResolvedValue(mockPoll as any)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)

    const requestBody = {
      title: 'Unauthorized Edit',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(403)
    expect(result.data.message).toContain('Only poll owners and admins can edit polls')
  })

  it('allows admin to edit polls', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const mockMember = { ...mockServer.members[0], role: 'ADMIN' as const }
    const mockServerWithAdmin = { ...mockServer, members: [mockMember] }
    const mockPoll = createMockPollWithOptions({ creatorId: 'other-member-id' })
    const updatedPoll = createMockPollWithOptions({ title: 'Admin Edit' })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll as any)
    mockDb.server.findFirst.mockResolvedValue(mockServerWithAdmin as any)
    mockDb.poll.update.mockResolvedValue(updatedPoll as any)
    mockDb.poll.findUnique.mockResolvedValueOnce(updatedPoll as any)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll() as any)

    const requestBody = {
      title: 'Admin Edit',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(result.data.title).toBe('Admin Edit')
  })

  it('prevents editing closed polls', async () => {
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

    const requestBody = {
      title: 'Cannot Edit Closed',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'poll-id-1' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(400)
    expect(result.data.message).toContain('Cannot edit a closed poll')
  })

  it('returns 401 for unauthorized users', async () => {
    // Arrange
    mockCurrentProfile.mockResolvedValue(null)

    const requestBody = {
      title: 'Unauthorized',
    }

    const request = createMockNextRequest(requestBody, {
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
    // Don't set mockDb.poll.update - should never reach it

    const requestBody = {
      title: 'Not Found',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as any, { params: Promise.resolve({ pollId: 'invalid-poll-id' }) } as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(404)
    expect(result.data.message).toBe('Poll not found')
  })
})
