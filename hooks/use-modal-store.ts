import { create } from "zustand"
import { Channel, ChannelType, Server, MemberRole, Member, Profile } from "@prisma/client"
import { PollWithOptionsAndVotes } from "@/types"

export type ModalType = "createServer" | "joinServer" | "invite" | "editServer" | "members" | "createChannel" | "leaveServer" | "deleteServer" | "deleteChannel" | "editChannel" | "messageFile" | "deleteMessage" | "createPoll" | "editPoll" | "initialModal" | "account"

interface ModalData {
  server?: Server
  channelType?: ChannelType
  channel?: Channel
  apiUrl?: string
  query?: Record<string, unknown>
  poll?: PollWithOptionsAndVotes
  currentMemberId?: string
  currentMemberRole?: MemberRole
  member?: Member & { profile: Profile }
  profile?: Profile
}

interface ModalStore {
  type: ModalType | null
  data: ModalData
  isOpen: boolean
  onOpen: (type: ModalType, data?: ModalData) => void
  onClose: () => void
}

export const useModal = create<ModalStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,
  onOpen: (type: ModalType, data?: ModalData) => set({ type, isOpen: true, data }),
  onClose: () => set({ type: null, isOpen: false }),
}))