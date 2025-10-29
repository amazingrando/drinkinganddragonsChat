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
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className="flex-shrink-0 w-4 h-4 mr-2 text-icon-foreground" />,
  [ChannelType.AUDIO]: <Mic className="w-4 h-4 mr-2 text-icon-foreground" />,
  [ChannelType.VIDEO]: <Video className="w-4 h-4 mr-2 text-icon-foreground" />,
}

export const ServerChannel = ({ channel, server, role }: ServerChannelProps) => {
  const { onOpen } = useModal()
  const params = useParams()
  const router = useRouter()

  const onClick = () => {
    router.push(`/servers/${params?.serverId}/channels/${channel.id}`)
  }

  const onAction = (e: React.MouseEvent, action: ModalType) => {
    e.stopPropagation()
    onOpen(action, { channel, server })
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "group px-2 py-2 rounded-md flex items-center gap-x-1 w-full hover:bg-muted/60 transition mb-1",
        params?.channelId === channel.id && "bg-muted hover:bg-muted",
      )}
    >
      {iconMap[channel.type]}
      <p className={cn("font-semibold text-sm text-muted-foreground group-hover:text-foreground transition whitespace-nowrap text-ellipsis max-w-full overflow-hidden",
        params?.channelId === channel.id && "text-foreground",
      )}>
        {channel.name}
      </p>

      {channel.name !== "general" && role !== MemberRole.MEMBER && (
        <div className="ml-auto flex items-center gap-x-2">
          <ActionTooltip label="Edit">
            <Edit onClick={(e) => onAction(e, "editChannel")} className="hidden group-hover:block w-4 h-4 text-icon-muted-foreground hover:text-foreground dark:hover:text-white transition" />
          </ActionTooltip>
          <ActionTooltip label="Delete">
            <Trash onClick={(e) => onAction(e, "deleteChannel")} className="hidden group-hover:block w-4 h-4 text-icon-muted-foreground hover:text-foreground dark:hover:text-white transition" />
          </ActionTooltip>
        </div>
      )}

      {channel.name === "general" && (
        <Lock className="ml-auto w-4 h-4 text-muted-foreground/60" />
      )}
    </button>
  )
}