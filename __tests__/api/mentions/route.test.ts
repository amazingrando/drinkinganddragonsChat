import { NextRequest } from "next/server"
import { GET } from "@/app/api/mentions/route"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { rateLimitPresets } from "@/lib/rate-limit"
import {
  createMockProfile,
  createMockMember,
  createMockChannel,
  parseNextResponse,
} from "@/__tests__/utils/test-helpers"

// Mock dependencies
jest.mock("@/lib/current-profile")
jest.mock("@/lib/db")
jest.mock("@/lib/rate-limit")

const mockCurrentProfile = currentProfile as jest.MockedFunction<typeof currentProfile>
const mockDb = db as jest.Mocked<typeof db>
const mockRateLimit = rateLimitPresets.lenient as jest.MockedFunction<typeof rateLimitPresets.lenient>

describe("GET /api/mentions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimit.mockResolvedValue(null) // No rate limit
  })

  describe("Authentication", () => {
    it("should return 401 if user is not authenticated", async () => {
      mockCurrentProfile.mockResolvedValue(null)

      const request = new NextRequest("http://localhost/api/mentions?serverId=test&query=test")
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(401)
      expect(parsed.data).toHaveProperty("error")
      expect(parsed.data.error).toBe("Unauthorized")
    })
  })

  describe("Validation", () => {
    beforeEach(() => {
      mockCurrentProfile.mockResolvedValue(createMockProfile())
    })

    it("should return 400 if serverId is missing", async () => {
      const request = new NextRequest("http://localhost/api/mentions?query=test")
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(400)
      expect(parsed.data).toHaveProperty("error")
      expect(parsed.data.error).toBe("Server ID is required")
    })

    it("should return 400 if serverId is not a valid UUID", async () => {
      const request = new NextRequest("http://localhost/api/mentions?serverId=not-a-uuid&query=test")
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(400)
      expect(parsed.data).toHaveProperty("error")
      expect(parsed.data.error).toContain("Invalid server ID format")
    })

    it("should return 400 if query is too long", async () => {
      const longQuery = "a".repeat(101) // MAX_QUERY_LENGTH is 100
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=${longQuery}`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(400)
      expect(parsed.data).toHaveProperty("error")
      expect(parsed.data.error).toBe("Query too long")
    })
  })

  describe("Authorization", () => {
    beforeEach(() => {
      mockCurrentProfile.mockResolvedValue(createMockProfile({ id: "profile-id-1" }))
    })

    it("should return 403 if user is not a member of the server", async () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      mockDb.member.findFirst.mockResolvedValue(null)

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=test`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(403)
      expect(parsed.data).toHaveProperty("error")
      expect(parsed.data.error).toBe("Access denied")
    })
  })

  describe("User search", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000"
    const profile = createMockProfile({ id: "profile-id-1" })

    beforeEach(() => {
      mockCurrentProfile.mockResolvedValue(profile)
      mockDb.member.findFirst.mockResolvedValue(
        createMockMember({ profileID: profile.id, serverID: validUuid }),
      )
    })

    it("should return users matching query", async () => {
      const otherProfile = createMockProfile({ id: "profile-id-2", name: "TestUser" })
      const otherMember = createMockMember({
        id: "member-id-2",
        profileID: otherProfile.id,
        serverID: validUuid,
        profile: otherProfile,
      })

      mockDb.member.findMany.mockResolvedValue([otherMember])

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=Test&type=user`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(200)
      expect(Array.isArray(parsed.data)).toBe(true)
      expect(parsed.data).toHaveLength(1)
      expect(parsed.data[0]).toMatchObject({
        id: "member-id-2",
        name: "TestUser",
        type: "user",
      })
    })

    it("should exclude current user from results", async () => {
      const currentUserMember = createMockMember({
        id: "member-id-1",
        profileID: profile.id,
        serverID: validUuid,
        profile: profile,
      })

      mockDb.member.findMany.mockResolvedValue([currentUserMember])

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=Test&type=user`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(200)
      expect(parsed.data).toHaveLength(0)
    })

    it("should return empty array if no users match", async () => {
      mockDb.member.findMany.mockResolvedValue([])

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=NonExistent&type=user`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(200)
      expect(parsed.data).toEqual([])
    })
  })

  describe("Channel search", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000"
    const profile = createMockProfile({ id: "profile-id-1" })

    beforeEach(() => {
      mockCurrentProfile.mockResolvedValue(profile)
      mockDb.member.findFirst.mockResolvedValue(
        createMockMember({ profileID: profile.id, serverID: validUuid }),
      )
    })

    it("should return channels matching query", async () => {
      const channel = createMockChannel({
        id: "channel-id-1",
        name: "general",
        serverID: validUuid,
      })

      mockDb.channel.findMany.mockResolvedValue([channel])

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=gen&type=channel`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(200)
      expect(Array.isArray(parsed.data)).toBe(true)
      expect(parsed.data).toHaveLength(1)
      expect(parsed.data[0]).toMatchObject({
        id: "channel-id-1",
        name: "general",
        type: "channel",
      })
    })

    it("should only return TEXT channels", async () => {
      const textChannel = createMockChannel({
        id: "channel-id-1",
        name: "general",
        type: "TEXT",
        serverID: validUuid,
      })

      mockDb.channel.findMany.mockResolvedValue([textChannel])

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=channel&type=channel`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(200)
      expect(parsed.data).toHaveLength(1)
      expect(parsed.data[0].type).toBe("channel")
    })
  })

  describe("Combined search", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000"
    const profile = createMockProfile({ id: "profile-id-1" })

    beforeEach(() => {
      mockCurrentProfile.mockResolvedValue(profile)
      mockDb.member.findFirst.mockResolvedValue(
        createMockMember({ profileID: profile.id, serverID: validUuid }),
      )
    })

    it("should return both users and channels when type is not specified", async () => {
      const otherProfile = createMockProfile({ id: "profile-id-2", name: "TestUser" })
      const member = createMockMember({
        id: "member-id-2",
        profileID: otherProfile.id,
        serverID: validUuid,
        profile: otherProfile,
      })
      const channel = createMockChannel({
        id: "channel-id-1",
        name: "general",
        serverID: validUuid,
      })

      mockDb.member.findMany.mockResolvedValue([member])
      mockDb.channel.findMany.mockResolvedValue([channel])

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=test`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(200)
      expect(parsed.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("Rate limiting", () => {
    it("should respect rate limits", async () => {
      mockRateLimit.mockResolvedValue(
        new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }),
      )

      const request = new NextRequest("http://localhost/api/mentions?serverId=test&query=test")
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(429)
    })
  })

  describe("Type parameter validation", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000"
    const profile = createMockProfile({ id: "profile-id-1" })

    beforeEach(() => {
      mockCurrentProfile.mockResolvedValue(profile)
      mockDb.member.findFirst.mockResolvedValue(
        createMockMember({ profileID: profile.id, serverID: validUuid }),
      )
    })

    it("should accept valid type parameter 'user'", async () => {
      mockDb.member.findMany.mockResolvedValue([])

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=test&type=user`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(200)
    })

    it("should accept valid type parameter 'channel'", async () => {
      mockDb.channel.findMany.mockResolvedValue([])

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=test&type=channel`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(200)
    })

    it("should ignore invalid type parameter and return both users and channels", async () => {
      mockDb.member.findMany.mockResolvedValue([])
      mockDb.channel.findMany.mockResolvedValue([])

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=test&type=invalid`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(200)
      // Should still return results (both types when type is invalid)
      expect(mockDb.member.findMany).toHaveBeenCalled()
      expect(mockDb.channel.findMany).toHaveBeenCalled()
    })
  })

  describe("Error handling", () => {
    beforeEach(() => {
      mockCurrentProfile.mockResolvedValue(createMockProfile())
    })

    it("should return 500 on database error with JSON response", async () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      mockDb.member.findFirst.mockRejectedValue(new Error("Database error"))

      const request = new NextRequest(
        `http://localhost/api/mentions?serverId=${validUuid}&query=test`,
      )
      const response = await GET(request)
      const parsed = await parseNextResponse(response)

      expect(parsed.status).toBe(500)
      expect(parsed.data).toHaveProperty("error")
      expect(parsed.data.error).toBe("Internal Server Error")
    })

    it("should return JSON error responses for all error cases", async () => {
      // Test 401
      mockCurrentProfile.mockResolvedValue(null)
      const request1 = new NextRequest("http://localhost/api/mentions?serverId=test&query=test")
      const response1 = await GET(request1)
      const parsed1 = await parseNextResponse(response1)
      expect(parsed1.status).toBe(401)
      expect(parsed1.data).toHaveProperty("error")

      // Test 400 - missing serverId
      mockCurrentProfile.mockResolvedValue(createMockProfile())
      const request2 = new NextRequest("http://localhost/api/mentions?query=test")
      const response2 = await GET(request2)
      const parsed2 = await parseNextResponse(response2)
      expect(parsed2.status).toBe(400)
      expect(parsed2.data).toHaveProperty("error")
    })
  })
})

