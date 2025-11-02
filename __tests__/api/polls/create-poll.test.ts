import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { POST } from '@/app/api/polls/route'
import { db } from '@/lib/db'
import { currentProfile } from '@/lib/current-profile'
import { broadcastMessage } from '@/lib/supabase/server-broadcast'
import {
  createMockProfile,
  createMockServerWithMembers,
  createMockChannel,
  createMockMessageWithPoll,
  createMockPollWithOptions,
  createMockNextRequest,
  parseNextResponse,
} from '@/__tests__/utils/test-helpers'

const mockDb = db as any
const mockCurrentProfile = currentProfile as any
const mockBroadcastMessage = broadcastMessage as any

describe('POST /api/polls - Create Poll', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates poll with valid data', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const mockChannel = createMockChannel()
    const mockPoll = createMockPollWithOptions()
    const mockMessage = createMockMessageWithPoll({ poll: mockPoll })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)
    mockDb.channel.findFirst.mockResolvedValue(mockChannel as any)
    mockDb.message.create.mockResolvedValue(mockMessage as any)
    mockDb.poll.create.mockResolvedValue(mockPoll as any)
    mockDb.message.findUnique.mockResolvedValue(mockMessage as any)

    const requestBody = {
      title: 'Test Poll',
      options: ['Option 1', 'Option 2'],
      allowMultipleChoices: false,
      allowAddOptions: false,
    }

    const request = createMockNextRequest(requestBody, {
      serverId: 'server-id-1',
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(result.data.title).toBe('Test Poll')
    expect(result.data.options).toHaveLength(2)
    expect(mockDb.poll.create).toHaveBeenCalled()
    expect(mockBroadcastMessage).toHaveBeenCalled()
  })

  it('validates required fields - missing serverId', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    mockCurrentProfile.mockResolvedValue(mockProfile)

    const requestBody = {
      title: 'Test Poll',
      options: ['Option 1', 'Option 2'],
      allowMultipleChoices: false,
      allowAddOptions: false,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(400)
    expect(result.data.message).toContain('Server ID is required')
  })

  it('validates required fields - missing channelId', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    mockCurrentProfile.mockResolvedValue(mockProfile)

    const requestBody = {
      title: 'Test Poll',
      options: ['Option 1', 'Option 2'],
      allowMultipleChoices: false,
      allowAddOptions: false,
    }

    const request = createMockNextRequest(requestBody, {
      serverId: 'server-id-1',
    })

    // Act
    const response = await POST(request as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(400)
    expect(result.data.message).toContain('Channel ID is required')
  })

  it('requires at least 2 options', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    mockCurrentProfile.mockResolvedValue(mockProfile)

    const requestBody = {
      title: 'Test Poll',
      options: ['Only one option'],
      allowMultipleChoices: false,
      allowAddOptions: false,
    }

    const request = createMockNextRequest(requestBody, {
      serverId: 'server-id-1',
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(400)
    expect(result.data.message).toContain('At least 2 options are required')
  })

  it('calculates end date from durationHours', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const mockChannel = createMockChannel()
    const mockPoll = createMockPollWithOptions()
    const mockMessage = createMockMessageWithPoll({ poll: mockPoll })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)
    mockDb.channel.findFirst.mockResolvedValue(mockChannel as any)
    mockDb.message.create.mockResolvedValue(mockMessage as any)
    mockDb.poll.create.mockResolvedValue(mockPoll as any)
    mockDb.message.findUnique.mockResolvedValue(mockMessage as any)

    const requestBody = {
      title: 'Test Poll',
      options: ['Option 1', 'Option 2'],
      allowMultipleChoices: false,
      allowAddOptions: false,
      durationHours: 24,
    }

    const request = createMockNextRequest(requestBody, {
      serverId: 'server-id-1',
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(mockDb.poll.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          endsAt: expect.any(Date),
        }),
      })
    )
  })

  it('calculates end date from durationDays', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    const mockChannel = createMockChannel()
    const mockPoll = createMockPollWithOptions()
    const mockMessage = createMockMessageWithPoll({ poll: mockPoll })

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)
    mockDb.channel.findFirst.mockResolvedValue(mockChannel as any)
    mockDb.message.create.mockResolvedValue(mockMessage as any)
    mockDb.poll.create.mockResolvedValue(mockPoll as any)
    mockDb.message.findUnique.mockResolvedValue(mockMessage as any)

    const requestBody = {
      title: 'Test Poll',
      options: ['Option 1', 'Option 2'],
      allowMultipleChoices: false,
      allowAddOptions: false,
      durationDays: 7,
    }

    const request = createMockNextRequest(requestBody, {
      serverId: 'server-id-1',
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(mockDb.poll.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          endsAt: expect.any(Date),
        }),
      })
    )
  })

  it('returns 401 for unauthorized users', async () => {
    // Arrange
    mockCurrentProfile.mockResolvedValue(null)

    const requestBody = {
      title: 'Test Poll',
      options: ['Option 1', 'Option 2'],
      allowMultipleChoices: false,
      allowAddOptions: false,
    }

    const request = createMockNextRequest(requestBody, {
      serverId: 'server-id-1',
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(401)
    expect(result.data.message).toBe('Unauthorized')
  })

  it('returns 404 for invalid server', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.server.findFirst.mockResolvedValue(null)

    const requestBody = {
      title: 'Test Poll',
      options: ['Option 1', 'Option 2'],
      allowMultipleChoices: false,
      allowAddOptions: false,
    }

    const request = createMockNextRequest(requestBody, {
      serverId: 'invalid-server-id',
      channelId: 'channel-id-1',
    })

    // Act
    const response = await POST(request as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(404)
    expect(result.data.message).toBe('Server not found')
  })

  it('returns 404 for invalid channel', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.server.findFirst.mockResolvedValue(mockServer as any)
    mockDb.channel.findFirst.mockResolvedValue(null)

    const requestBody = {
      title: 'Test Poll',
      options: ['Option 1', 'Option 2'],
      allowMultipleChoices: false,
      allowAddOptions: false,
    }

    const request = createMockNextRequest(requestBody, {
      serverId: 'server-id-1',
      channelId: 'invalid-channel-id',
    })

    // Act
    const response = await POST(request as any)
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(404)
    expect(result.data.message).toBe('Channel not found')
  })
})
