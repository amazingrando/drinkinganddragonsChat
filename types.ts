import { Member, Profile, Server, Poll, PollOption, PollVote, Message } from "@prisma/client"

export type ServerWithMembersWithProfiles = Server & {
  members: (Member & { profile: Profile })[]
}

export type PollWithOptionsAndVotes = Poll & {
  optionOrder?: string[] | null
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