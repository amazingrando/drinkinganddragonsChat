"use client"

import { cn } from "@/lib/utils"
import { Channel, ChannelType, MemberRole, Server } from "@prisma/client"
import { Hash, Mic, Video, Lock, Edit, Trash } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { ActionTooltip } from "../action-tooltip"
import { useModal, ModalType } from "@/hooks/use-modal-store"

interface ServerChannelProps {
  channel: Channel
  server: Server
  role?: MemberRole
  unreadCount?: number
  mentionCount?: number
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className="flex-shrink-0 w-4 h-4 mr-2 text-icon-foreground" />,
  [ChannelType.AUDIO]: <Mic className="w-4 h-4 mr-2 text-icon-foreground" />,
  [ChannelType.VIDEO]: <Video className="w-4 h-4 mr-2 text-icon-foreground" />,
}

export const ServerChannel = ({ channel, server, role, unreadCount = 0, mentionCount = 0 }: ServerChannelProps) => {
  const { onOpen } = useModal()
  const params = useParams()
  const router = useRouter()

  const hasUnread = unreadCount > 0
  const hasMentions = mentionCount > 0
  const formattedMentionCount = mentionCount > 99 ? "99+" : mentionCount.toString()

  const onClick = () => {
    router.push(`/servers/${params?.serverId}/channels/${channel.id}`)
  }

  const onAction = (e: React.MouseEvent, action: ModalType) => {
    e.stopPropagation()
    onOpen(action, { channel, server })
  }

  const canManageChannel = channel.name !== "general" && role !== MemberRole.MEMBER
  const showLock = channel.name === "general"
  const showTrailing = canManageChannel || showLock

  const accessibilityLabel = hasMentions
    ? `${channel.name} (${mentionCount} mention${mentionCount === 1 ? "" : "s"})`
    : hasUnread
    ? `${channel.name} (unread)`
    : channel.name

  return (
    <button
      onClick={onClick}
      aria-label={accessibilityLabel}
      className={cn(
        "group px-2 py-2 rounded-md flex items-center gap-x-1 w-full hover:bg-muted/60 transition mb-1",
        params?.channelId === channel.id && "bg-muted hover:bg-muted",
      )}
    >
      {iconMap[channel.type]}
      <div className="flex items-center gap-x-1 min-w-0">
        <p
          className={cn(
            "font-semibold text-sm text-muted-foreground group-hover:text-foreground transition whitespace-nowrap text-ellipsis max-w-full overflow-hidden",
            params?.channelId === channel.id && "text-foreground",
          )}
        >
          {channel.name}
        </p>
        {hasMentions && (
          <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
            <span className="sr-only">{`${mentionCount} mention${mentionCount === 1 ? "" : "s"}`}</span>
            <span aria-hidden="true">{formattedMentionCount}</span>
          </span>
        )}
        {hasUnread && !hasMentions && (
          <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-label="Unread messages">
            <span className="sr-only">Unread messages</span>
          </span>
        )}
      </div>
      {showTrailing && (
        <div className="ml-auto flex items-center gap-x-2">
          {canManageChannel && (
            <div className="flex items-center gap-x-2">
              <ActionTooltip label="Edit">
                <Edit
                  onClick={(e) => onAction(e, "editChannel")}
                  className="hidden group-hover:block w-4 h-4 text-icon-muted-foreground hover:text-foreground dark:hover:text-white transition"
                />
              </ActionTooltip>
              <ActionTooltip label="Delete">
                <Trash
                  onClick={(e) => onAction(e, "deleteChannel")}
                  className="hidden group-hover:block w-4 h-4 text-icon-muted-foreground hover:text-foreground dark:hover:text-white transition"
                />
              </ActionTooltip>
            </div>
          )}
          {showLock && (
            <Lock className="w-4 h-4 text-muted-foreground/60" />
          )}
        </div>
      )}
    </button>
  )
}