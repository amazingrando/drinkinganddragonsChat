import { mock } from 'jest-mock-extended'
import { PrismaClient, Profile, Server, Member, Channel, Message, Poll, PollOption, PollVote } from '@prisma/client'

// Create a mocked Prisma client
export const createMockPrismaClient = () => {
  const mockPrisma = mock<PrismaClient>()
  return mockPrisma
}

// Mock data generators
export const createMockProfile = (overrides?: Partial<Profile>) => ({
  id: 'profile-id-1',
  userId: 'user-id-1',
  name: 'Test User',
  imageUrl: 'https://example.com/image.png',
  email: 'test@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockServer = (overrides?: Partial<Server>) => ({
  id: 'server-id-1',
  name: 'Test Server',
  imageUrl: 'https://example.com/server.png',
  inviteCode: 'TEST123',
  profileID: 'profile-id-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockMember = (overrides?: Partial<Member>) => ({
  id: 'member-id-1',
  role: 'MEMBER' as const,
  profileID: 'profile-id-1',
  serverID: 'server-id-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockChannel = (overrides?: Partial<Channel>) => ({
  id: 'channel-id-1',
  name: 'general',
  type: 'TEXT' as const,
  profileID: 'profile-id-1',
  serverID: 'server-id-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockMessage = (overrides?: Partial<Message>) => ({
  id: 'message-id-1',
  content: 'Test message',
  fileUrl: null,
  memberId: 'member-id-1',
  channelId: 'channel-id-1',
  deleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockPoll = (overrides?: Partial<Poll>) => ({
  id: 'poll-id-1',
  title: 'Test Poll',
  allowMultipleChoices: false,
  allowAddOptions: false,
  endsAt: null,
  closedAt: null,
  creatorId: 'member-id-1',
  messageId: 'message-id-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockPollOption = (overrides?: Partial<PollOption>) => ({
  id: 'option-id-1',
  text: 'Option 1',
  pollId: 'poll-id-1',
  createdBy: 'member-id-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  votes: [],
  ...overrides,
})

export const createMockPollVote = (overrides?: Partial<PollVote>) => ({
  id: 'vote-id-1',
  pollId: 'poll-id-1',
  optionId: 'option-id-1',
  memberId: 'member-id-1',
  createdAt: new Date(),
  ...overrides,
})

export const createMockServerWithMembers = (overrides?: Partial<Server & { members: Member[] }>) => ({
  ...createMockServer(),
  members: [
    createMockMember({ id: 'member-id-1', role: 'ADMIN' as const }),
    createMockMember({ id: 'member-id-2', role: 'MEMBER' as const }),
  ],
  ...overrides,
})

export const createMockPollWithOptions = (overrides?: Partial<Poll & { options: PollOption[]; creator: Member & { profile: Profile } }>) => ({
  ...createMockPoll(),
  options: [
    createMockPollOption({ id: 'option-id-1', text: 'Option 1' }),
    createMockPollOption({ id: 'option-id-2', text: 'Option 2' }),
  ],
  creator: {
    ...createMockMember({ id: 'member-id-1' }),
    profile: createMockProfile(),
  },
  ...overrides,
})

export const createMockPollWithVotes = (overrides?: Partial<Poll & { options: (PollOption & { votes: (PollVote & { member: Member & { profile: Profile } })[] })[]; creator: Member & { profile: Profile } }>) => ({
  ...createMockPoll(),
  options: [
    {
      ...createMockPollOption({ id: 'option-id-1', text: 'Option 1' }),
      votes: [
        {
          ...createMockPollVote({ id: 'vote-id-1' }),
          member: {
            ...createMockMember({ id: 'member-id-1' }),
            profile: createMockProfile(),
          },
        },
      ],
    },
    {
      ...createMockPollOption({ id: 'option-id-2', text: 'Option 2' }),
      votes: [],
    },
  ],
  creator: {
    ...createMockMember({ id: 'member-id-1' }),
    profile: createMockProfile(),
  },
  ...overrides,
})

export const createMockMessageWithPoll = (overrides?: Partial<Message & { poll: Poll & { options: PollOption[]; creator: Member & { profile: Profile } }; member: Member & { profile: Profile } }>) => ({
  ...createMockMessage(),
  poll: createMockPollWithOptions(),
  member: {
    ...createMockMember(),
    profile: createMockProfile(),
  },
  ...overrides,
})

// Helper to create NextRequest with body
export const createMockNextRequest = (body: unknown, searchParams?: Record<string, string>) => {
  const url = new URL('http://localhost/api/test')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers(),
    url: url.toString(),
  } as unknown as Request
}

// Helper to create NextResponse from handler
export const parseNextResponse = async (response: Response): Promise<{ status: number; data: unknown }> => {
  const text = await response.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return {
    status: response.status,
    data,
  }
}
