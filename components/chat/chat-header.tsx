"use client"

import { Hash, Pin } from "lucide-react"
import UserAvatar from "@/components/user-avatar"
import { SocketIndicator } from "@/components/socket-indicator"
import { ChatVideoButton } from "./chat-video-button"
import { useModal } from "@/hooks/use-modal-store"
import { cn } from "@/lib/utils"
import { MemberRole } from "@prisma/client"
import { ReactNode } from "react"

interface ChatHeaderProps {
  serverId: string
  name: string
  type: "channel" | "conversation"
  imageUrl?: string
  description?: string | null
  channelId?: string
  memberRole?: MemberRole
  mobileToggle?: ReactNode
}

const ChatHeader = ({ serverId, name, type, imageUrl, description, channelId, memberRole, mobileToggle }: ChatHeaderProps) => {
  const { onOpen } = useModal()

  const handleDescriptionClick = () => {
    if (type === "channel" && channelId) {
      // Pass minimal data - modal will handle fetching full channel/server data if needed
      onOpen("channelDetails", {
        channel: { id: channelId, name, description: description || null } as { id: string; name: string; description: string | null },
        server: { id: serverId } as { id: string },
        currentMemberRole: memberRole
      })
    }
  }

  const handlePinnedMessagesClick = () => {
    if (type === "channel" && channelId) {
      onOpen("pinnedMessages", {
        channelId,
        serverId,
      })
    }
  }

  return (
    <div className="text-md font-semibold px-3 flex items-center h-12 border-b-2 border-border">
      {mobileToggle}
      {type === "channel" && (
        <Hash className="w-5 h-5 text-icon-foreground mr-2" />
      )}
      {type === "conversation" && (
        <UserAvatar src={name} imageUrl={imageUrl} className="w-8 h-8 md:w-8 md:h-8 mr-2" />
      )}
      <div className="flex items-end gap-2 min-w-0">
        <p className="font-semibold text-md text-black dark:text-white">
          {name}
        </p>
        {type === "channel" && description && (
          <button
            onClick={handleDescriptionClick}
            className={cn(
              "text-sm font-medium text-muted-foreground hover:text-foreground transition truncate max-w-[200px]",
              "cursor-pointer"
            )}
            title="Click to view channel details"
          >
            {description}
          </button>
        )}
        {type === "channel" && !description && (
          <button
            onClick={handleDescriptionClick}
            className={cn(
              "text-sm font-medium text-muted-foreground/50 hover:text-muted-foreground transition",
              "cursor-pointer"
            )}
            title="Click to view channel details"
          >
            No description
          </button>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {type === "channel" && (
          <button
            onClick={handlePinnedMessagesClick}
            className="p-1.5 rounded-md hover:bg-lavender-200 dark:hover:bg-background/70 transition"
            title="Pinned Messages"
          >
            <Pin className="w-4 h-4 text-icon-muted-foreground hover:text-lavender-800 dark:hover:text-white transition" />
          </button>
        )}
        {type === "conversation" && (
          <ChatVideoButton />
        )}
        <SocketIndicator />
      </div>
    </div>
  )
}

export default ChatHeader