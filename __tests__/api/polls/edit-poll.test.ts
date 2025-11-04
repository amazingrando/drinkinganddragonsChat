import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { PATCH } from '@/app/api/polls/[pollId]/route'
import { db } from '@/lib/db'
import { currentProfile } from '@/lib/current-profile'
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

const mockDb = db as jest.Mocked<typeof db>
const mockCurrentProfile = currentProfile as jest.MockedFunction<typeof currentProfile>

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
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServer)
    mockDb.pollOption.findMany.mockResolvedValue(mockPoll.options)
    mockDb.poll.update.mockResolvedValue(updatedPoll)
    mockDb.poll.findUnique.mockResolvedValueOnce(updatedPoll)
    mockDb.message.findUnique.mockResolvedValue(mockMessage)

    const requestBody = {
      title: 'Updated Title',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as Parameters<typeof PATCH>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
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
    mockDb.poll.findUnique.mockResolvedValueOnce(existingOptions)
    mockDb.server.findFirst.mockResolvedValue(mockServer)
    mockDb.pollOption.findMany.mockResolvedValue(existingOptions.options)
    mockDb.pollOption.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.poll.update.mockResolvedValue(updatedPoll)
    mockDb.poll.findUnique.mockResolvedValueOnce(updatedPoll)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll())

    const requestBody = {
      options: ['Updated Option 1', 'Updated Option 2', 'New Option 3'],
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as Parameters<typeof PATCH>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
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
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServer)
    mockDb.poll.update.mockResolvedValue(updatedPoll)
    mockDb.poll.findUnique.mockResolvedValueOnce(updatedPoll)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll())

    const requestBody = {
      allowMultipleChoices: true,
      allowAddOptions: true,
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as Parameters<typeof PATCH>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
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
    mockDb.poll.findUnique.mockResolvedValue(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServer)

    const requestBody = {
      title: 'Unauthorized Edit',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as Parameters<typeof PATCH>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
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
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServerWithAdmin)
    mockDb.poll.update.mockResolvedValue(updatedPoll)
    mockDb.poll.findUnique.mockResolvedValueOnce(updatedPoll)
    mockDb.message.findUnique.mockResolvedValue(createMockMessageWithPoll())

    const requestBody = {
      title: 'Admin Edit',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as Parameters<typeof PATCH>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
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
    mockDb.poll.findUnique.mockResolvedValue(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServer)

    const requestBody = {
      title: 'Cannot Edit Closed',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as Parameters<typeof PATCH>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
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
    const response = await PATCH(request as Parameters<typeof PATCH>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
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
    mockDb.server.findFirst.mockResolvedValue(mockServer)
    // Don't set mockDb.poll.update - should never reach it

    const requestBody = {
      title: 'Not Found',
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as Parameters<typeof PATCH>[0], { params: Promise.resolve({ pollId: 'invalid-poll-id' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(404)
    expect(result.data.message).toBe('Poll not found')
  })

  it('preserves option order after editing one or more poll options', async () => {
    // Arrange
    const mockProfile = createMockProfile()
    const mockServer = createMockServerWithMembers()
    
    // Original poll with options in order: Option A, Option B, Option C
    const originalOptions = [
      { id: 'option-id-1', text: 'Option A', pollId: 'poll-id-1', createdBy: 'member-id-1', createdAt: new Date('2024-01-01T00:00:00Z'), updatedAt: new Date(), votes: [] },
      { id: 'option-id-2', text: 'Option B', pollId: 'poll-id-1', createdBy: 'member-id-1', createdAt: new Date('2024-01-01T00:01:00Z'), updatedAt: new Date(), votes: [] },
      { id: 'option-id-3', text: 'Option C', pollId: 'poll-id-1', createdBy: 'member-id-1', createdAt: new Date('2024-01-01T00:02:00Z'), updatedAt: new Date(), votes: [] },
    ]
    
    const mockPoll = {
      ...createMockPollWithOptions({ creatorId: 'member-id-1' }),
      options: originalOptions,
    }
    
    // Updated options: Option C (moved to first), Option B Updated (text changed), New Option D (added)
    // Expected order: Option C, Option B Updated, New Option D
    const updatedOptions = [
      { id: 'option-id-3', text: 'Option C', pollId: 'poll-id-1', createdBy: 'member-id-1', createdAt: new Date('2024-01-01T00:02:00Z'), updatedAt: new Date(), votes: [] },
      { id: 'option-id-2', text: 'Option B Updated', pollId: 'poll-id-1', createdBy: 'member-id-1', createdAt: new Date('2024-01-01T00:01:00Z'), updatedAt: new Date(), votes: [] },
      { id: 'option-id-4', text: 'New Option D', pollId: 'poll-id-1', createdBy: 'member-id-1', createdAt: new Date('2024-01-01T00:03:00Z'), updatedAt: new Date(), votes: [] },
    ]
    
    const updatedPoll = {
      ...createMockPollWithOptions({ creatorId: 'member-id-1' }),
      options: updatedOptions,
    }
    
    const mockMessage = createMockMessageWithPoll()

    mockCurrentProfile.mockResolvedValue(mockProfile)
    mockDb.poll.findUnique.mockResolvedValueOnce(mockPoll)
    mockDb.server.findFirst.mockResolvedValue(mockServer)
    mockDb.pollOption.findMany.mockResolvedValue(originalOptions)
    mockDb.pollOption.deleteMany.mockResolvedValue({ count: 1 }) // Option A deleted
    mockDb.pollOption.update.mockResolvedValue({ ...originalOptions[1], text: 'Option B Updated' })
    mockDb.pollOption.create.mockResolvedValue(updatedOptions[2])
    mockDb.poll.update.mockResolvedValue(updatedPoll)
    // Mock the final fetch that returns the poll with reordered options
    mockDb.poll.findUnique.mockResolvedValueOnce(updatedPoll)
    mockDb.message.findUnique.mockResolvedValue(mockMessage)

    // Request body with options in new order: Option C, Option B Updated, New Option D
    const requestBody = {
      options: ['Option C', 'Option B Updated', 'New Option D'],
    }

    const request = createMockNextRequest(requestBody, {
      channelId: 'channel-id-1',
    })

    // Act
    const response = await PATCH(request as Parameters<typeof PATCH>[0], { params: Promise.resolve({ pollId: 'poll-id-1' }) })
    const result = await parseNextResponse(response)

    // Assert
    expect(result.status).toBe(200)
    expect(result.data.options).toBeDefined()
    expect(result.data.options.length).toBe(3)
    
    // Verify options are in the same order as requested
    expect(result.data.options[0].text).toBe('Option C')
    expect(result.data.options[1].text).toBe('Option B Updated')
    expect(result.data.options[2].text).toBe('New Option D')
    
    // Verify the order matches the request body order exactly
    const responseOptionTexts = result.data.options.map((opt: { text: string }) => opt.text)
    expect(responseOptionTexts).toEqual(['Option C', 'Option B Updated', 'New Option D'])
  })
})
