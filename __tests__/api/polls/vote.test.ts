import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { POST } from '@/app/api/polls/[pollId]/vote/route'
import { db } from '@/lib/db'
import { currentProfile } from '@/lib/current-profile'
import { broadcastMessage } from '@/lib/supabase/server-broadcast'
import {
  createMockProfile,
  createMockServerWithMembers,
  createMockPollWithOptions,
  createMockPollWithVotes,
  createMockMessageWithPoll,
  createMockNextRequest,
  parseNextResponse,
  createMockMember,
  createMockPollVote,
} from '@/__tests__/utils/test-helpers'

const mockDb = db as jest.Mocked<typeof db>
const mockCurrentProfile = currentProfile as jest.MockedFunction<typeof currentProfile>
const mockBroadcastMessage = broadcastMessage as jest.MockedFunction<typeof broadcastMessage>

describe('POST /api/polls/[pollId]/vote - Vote on Poll', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('adds vote to option', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers({ members: [createMockMember({ profileID: mockProfile.id })] })
    const mockPoll = {
      ...createMockPollWithOptions(),
      message: {
        id: 'message-id-1',
        channel: {
          id: 'channel-id-1',
          server: mockServer,
        },
      },
    } as any
    const mockPollWithVotes = createMockPollWithVotes()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServer)
    mockDb.pollVote.findFirst.mockResolvedValue(null)
    mockDb.pollVote.create.mockResolvedValue(createMockPollVote())
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPollWithVotes)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll())

    const requestBody = {
      optionId: 'option-id-1',
      removeVote: false,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as Parameters<typeof POST>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(mockDb.pollVote.create).toHaveBeenCalled()
    expect(mockBroadcastMessage).toHaveBeenCalled()
  })

  it('removes vote when removeVote is true', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers({ members: [createMockMember({ profileID: mockProfile.id })] })
    const mockPoll = {
      ...createMockPollWithVotes(),
      message: {
        id: 'message-id-1',
        channel: {
          id: 'channel-id-1',
          server: mockServer,
        },
      },
    } as any
    const mockPollAfterRemove = createMockPollWithOptions()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServer)
    mockDb.pollVote.deleteMany.mockResolvedValue({ count: 1 })
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPollAfterRemove)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll())

    const requestBody = {
      optionId: 'option-id-1',
      removeVote: true,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as Parameters<typeof POST>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(mockDb.pollVote.deleteMany).toHaveBeenCalled()
    expect(mockBroadcastMessage).toHaveBeenCalled()
  })

  it('enforces single choice when allowMultipleChoices is false', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers({ members: [createMockMember({ profileID: mockProfile.id })] })
    const mockPoll = {
      ...createMockPollWithOptions({ allowMultipleChoices: false }),
      message: {
        id: 'message-id-1',
        channel: {
          id: 'channel-id-1',
          server: mockServer,
        },
      },
    } as any
    const mockPollWithVotes = createMockPollWithVotes()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServer)
    mockDb.pollVote.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.pollVote.findFirst.mockResolvedValue(null)
    mockDb.pollVote.create.mockResolvedValue(createMockPollVote())
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPollWithVotes)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll())

    const requestBody = {
      optionId: 'option-id-2',
      removeVote: false,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as Parameters<typeof POST>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(mockDb.pollVote.deleteMany).toHaveBeenCalledWith({
      where: {
        pollId: 'poll-id-1',
        memberId: expect.any(String),
      },
    })
  })

  it('allows multiple votes when allowMultipleChoices is true', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers({ members: [createMockMember({ profileID: mockProfile.id })] })
    const mockPoll = {
      ...createMockPollWithOptions({ allowMultipleChoices: true }),
      message: {
        id: 'message-id-1',
        channel: {
          id: 'channel-id-1',
          server: mockServer,
        },
      },
    } as any
    const mockPollWithVotes = createMockPollWithVotes()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServer)
    mockDb.pollVote.findFirst.mockResolvedValue(null)
    mockDb.pollVote.create.mockResolvedValue(createMockPollVote())
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPollWithVotes)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll())

    const requestBody = {
      optionId: 'option-id-2',
      removeVote: false,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as Parameters<typeof POST>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    // Should NOT delete existing votes when multiple choices are allowed
    expect(mockDb.pollVote.deleteMany).not.toHaveBeenCalledWith({
      where: {
        pollId: 'poll-id-1',
        memberId: expect.any(String),
      },
    })
  })

  it('prevents voting on closed polls', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockPoll = createMockPollWithOptions({
      closedAt: new Date(),
    })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValue(mockPoll)

    const requestBody = {
      optionId: 'option-id-1',
      removeVote: false,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as Parameters<typeof POST>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(400)
    expect(result.data.message).toBe('Poll is closed')
  })

  it('prevents voting on expired polls', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const pastDate = new Date()
    pastDate.setHours(pastDate.getHours() - 1)

    const mockPoll = createMockPollWithOptions({
      endsAt: pastDate,
      closedAt: null,
    })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValue(mockPoll)

    const requestBody = {
      optionId: 'option-id-1',
      removeVote: false,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as Parameters<typeof POST>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(400)
    expect(result.data.message).toBe('Poll is closed')
  })

  it('returns 404 for non-existent poll', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValue(null)

    const requestBody = {
      optionId: 'option-id-1',
      removeVote: false,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as Parameters<typeof POST>[0], { params: Promise.resolve({ pollId: 'invalid-poll-id' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(404)
    expect(result.data.message).toBe('Poll not found')
  })

  it('returns 401 for unauthorized users', async () => {
    // Arrange
    mockCurrentProfile.mockResolvedValue(null)

    const requestBody = {
      optionId: 'option-id-1',
      removeVote: false,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as Parameters<typeof POST>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(401)
    expect(result.data.message).toBe('Unauthorized')
  })
})
