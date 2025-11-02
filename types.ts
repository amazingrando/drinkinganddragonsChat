import { Member, Profile, Server, Poll, PollOption, PollVote, Message } from "@prisma/client"

export type ServerWithMembersWithProfiles = Server & {
  members: (Member & { profile: Profile })[]
}

export type PollWithOptionsAndVotes = Poll & {
  options: (PollOption & {
    votes: (PollVote & {
      member: Member & {
        profile: Profile
      }
    })[]
  })[]
  creator: Member & {
    profile: Profile
  }
}

export type MessageWithPoll = Message & {
  poll: PollWithOptionsAndVotes | null
  member: Member & {
    profile: Profile
  }
}