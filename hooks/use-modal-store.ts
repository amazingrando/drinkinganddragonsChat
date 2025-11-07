import { create } from "zustand"
import { Channel, ChannelType, Server, MemberRole } from "@prisma/client"
import { PollWithOptionsAndVotes } from "@/types"

export type ModalType = "createServer" | "joinServer" | "invite" | "editServer" | "members" | "createChannel" | "leaveServer" | "deleteServer" | "deleteChannel" | "editChannel" | "messageFile" | "deleteMessage" | "createPoll" | "editPoll" | "initialModal"

interface ModalData {
  server?: Server
  channelType?: ChannelType
  channel?: Channel
  apiUrl?: string
  query?: Record<string, unknown>
  poll?: PollWithOptionsAndVotes
  currentMemberId?: string
  currentMemberRole?: MemberRole
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