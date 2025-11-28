"use client"

import { cn } from "@/lib/utils"
import { Channel, ChannelType, MemberRole, Server } from "@prisma/client"
import { Hash, Mic, Video, Lock, Edit, Trash, Move, GripVertical } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { ActionTooltip } from "../action-tooltip"
import { useModal, ModalType } from "@/hooks/use-modal-store"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import axios from "axios"
import { useState, useEffect } from "react"

interface ServerChannelProps {
  channel: Channel
  server: Server
  role?: MemberRole
  unreadCount?: number
  mentionCount?: number
  categories?: Array<{ id: string; name: string }>
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className="flex-shrink-0 w-4 h-4 mr-2 text-icon-foreground" />,
  [ChannelType.AUDIO]: <Mic className="w-4 h-4 mr-2 text-icon-foreground" />,
  [ChannelType.VIDEO]: <Video className="w-4 h-4 mr-2 text-icon-foreground" />,
}

export const ServerChannel = ({ channel, server, role, unreadCount = 0, mentionCount = 0, categories = [] }: ServerChannelProps) => {
  const { onOpen } = useModal()
  const params = useParams()
  const router = useRouter()
  const [availableCategories, setAvailableCategories] = useState(categories)

  useEffect(() => {
    if (categories.length === 0 && role !== MemberRole.MEMBER) {
      // Fetch categories if not provided
      const fetchCategories = async () => {
        try {
          const response = await axios.get(`/api/servers/${server.id}/categories`)
          setAvailableCategories(response.data)
        } catch (error) {
          console.error("Failed to fetch categories", error)
        }
      }
      void fetchCategories()
    } else {
      setAvailableCategories(categories)
    }
  }, [categories, server.id, role])

  const canManageChannel = channel.name !== "general" && role !== MemberRole.MEMBER
  const isSortable = role !== MemberRole.MEMBER // Allow sorting for all channels (including general) if admin/moderator

  const handleMoveToCategory = async (categoryId: string | null) => {
    try {
      await axios.patch(
        `/api/channels/${channel.id}/category?serverId=${server.id}`,
        { categoryId }
      )
      router.refresh()
    } catch (error) {
      console.error("Failed to move channel", error)
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: channel.id,
    disabled: !isSortable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

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

  const showLock = channel.name === "general"
  const showTrailing = canManageChannel || showLock

  const accessibilityLabel = hasMentions
    ? `${channel.name} (${mentionCount} mention${mentionCount === 1 ? "" : "s"})`
    : hasUnread
      ? `${channel.name} (unread)`
      : channel.name

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50", "relative")}
    >
      <button
        onClick={onClick}
        onContextMenu={(e) => {
          if (canManageChannel) {
            e.preventDefault()
          }
        }}
        aria-label={accessibilityLabel}
        className={cn(
          "group px-1 py-2 rounded-md flex items-center gap-x-1 w-full hover:bg-muted/60 transition mb-1",
          params?.channelId === channel.id && "bg-muted hover:bg-muted",
        )}
      >
        {isSortable && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none mr-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground/60 hidden group-hover:block" />
          </div>
        )}
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
      {canManageChannel && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition">
              <button
                className="p-1 rounded hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation()
                }}
                aria-label="Channel options"
              >
                <Edit className="w-3 h-3" />
              </button>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={(e) => onAction(e, "editChannel")}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Channel
            </DropdownMenuItem>
            {availableCategories.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Move className="w-4 h-4 mr-2" />
                    Move to Category
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => handleMoveToCategory(null)}>
                      Ungrouped
                    </DropdownMenuItem>
                    {availableCategories.map((category) => (
                      <DropdownMenuItem
                        key={category.id}
                        onClick={() => handleMoveToCategory(category.id)}
                      >
                        {category.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={(e) => onAction(e, "deleteChannel")}
              className="text-destructive"
            >
              <Trash className="w-4 h-4 mr-2" />
              Delete Channel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}