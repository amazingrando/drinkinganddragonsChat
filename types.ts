import { Member, Profile, Server, Poll, PollOption, PollVote, Message, DirectMessage, MessageReaction } from "@prisma/client"

export type ServerWithMembersWithProfiles = Server & {
  members: (Member & { profile: Profile })[]
}

export type PollWithOptionsAndVotes = Poll & {
  optionOrder?: string[] | null
  options: (PollOption & {
    votes: (PollVote & {
      member: (Member & {
        profile: Profile
      }) | null
    })[]
  })[]
  creator: Member & {
    profile: Profile
  }
}

export type MessageReactionWithMember = MessageReaction & {
  member: Member & {
    profile: Profile
  }
}

export type MessageWithPoll = Message & {
  poll: PollWithOptionsAndVotes | null
  member: Member & {
    profile: Profile
  }
  reactions?: MessageReactionWithMember[]
}

export type DirectMessageWithMemberProfile = DirectMessage & {
  member: Member & {
    profile: Profile
  }
}

export type ChatMessage = (MessageWithPoll | DirectMessageWithMemberProfile) & {
  optimisticId?: string
  status?: "pending" | "failed" | "sent"
}