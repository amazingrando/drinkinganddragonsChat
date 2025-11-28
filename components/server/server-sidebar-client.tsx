"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Channel, ChannelType, Member, MemberRole, Profile, ChannelCategory } from "@prisma/client"
import { UseRealtime } from "@/components/providers/realtime-provider"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ServerHeader } from "@/components/server/server-header"
import { ScrollArea } from "@radix-ui/react-scroll-area"
import { ServerSearch } from "@/components/server/server-search"
import { ServerChannel } from "@/components/server/server-channel"
import { ServerMember } from "@/components/server/server-member"
import { ServerCategory } from "@/components/server/server-category"
import { Hash, Mic, ShieldAlert, ShieldCheck, Users, Video, Plus, ChevronDown, Settings } from "lucide-react"
import { ChatMessage, MessageWithPoll, ServerWithMembersWithProfiles } from "@/types"
import { useParams } from "next/navigation"
import { useModal } from "@/hooks/use-modal-store"
import { ActionTooltip } from "@/components/action-tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import axios from "axios"
import { useRouter } from "next/navigation"

type ChannelWithUnread = {
  channel: Channel
  unreadCount: number
  mentionCount: number
}

type CategoryWithChannels = ChannelCategory & {
  channels: ChannelWithUnread[]
}

type ServerSidebarClientProps = {
  server: ServerWithMembersWithProfiles
  role?: MemberRole
  categories?: CategoryWithChannels[]
  ungroupedChannels?: ChannelWithUnread[]
  members: (Member & { profile: Profile })[]
  currentMemberId: string | null
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className="w-4 h-4 mr-2" />,
  [ChannelType.AUDIO]: <Mic className="w-4 h-4 mr-2" />,
  [ChannelType.VIDEO]: <Video className="w-4 h-4 mr-2" />,
}

const roleIconMap = {
  [MemberRole.ADMIN]: <ShieldAlert className="w-4 h-4 mr-2 text-red-500" />,
  [MemberRole.MODERATOR]: <ShieldCheck className="w-4 h-4 mr-2 text-purple-500" />,
  [MemberRole.MEMBER]: <Users className="w-4 h-4 mr-2" />,
}

type UnreadMap = Record<string, number>
type MentionMap = Record<string, number>

type UnreadCountResponse = {
  unreadCount: number
  mentionCount: number
  lastMessageId?: string | null
}

type ServerSidebarState = {
  collapsedCategories: string[]
  collapsedMembers: boolean
}

const fetchSidebarPreferences = async (serverId: string): Promise<ServerSidebarState> => {
  try {
    const response = await fetch(`/api/servers/${serverId}/sidebar-preferences`, {
      method: "GET",
      cache: "no-store",
    })
    if (!response.ok) {
      console.error(`[SIDEBAR_PREFERENCES_FETCH_ERROR] Failed to fetch preferences for server ${serverId}`, response.status)
      return { collapsedCategories: [], collapsedMembers: false }
    }
    const data = (await response.json()) as ServerSidebarState
    return data
  } catch (error) {
    console.error("[SIDEBAR_PREFERENCES_FETCH_ERROR]", error)
    return { collapsedCategories: [], collapsedMembers: false }
  }
}

const saveSidebarPreferences = async (serverId: string, state: ServerSidebarState) => {
  try {
    const response = await fetch(`/api/servers/${serverId}/sidebar-preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(state),
    })
    if (!response.ok) {
      console.error(`[SIDEBAR_PREFERENCES_SAVE_ERROR] Failed to save preferences for server ${serverId}`, response.status)
    }
  } catch (error) {
    console.error("[SIDEBAR_PREFERENCES_SAVE_ERROR]", error)
  }
}

const isChannelMessage = (message: ChatMessage | undefined): message is MessageWithPoll => {
  return Boolean(message && "channelId" in message)
}

const buildInitialMap = (
  ungroupedChannels: ChannelWithUnread[],
  categories?: CategoryWithChannels[],
): UnreadMap => {
  const map: UnreadMap = {}
  for (const entry of ungroupedChannels) {
    map[entry.channel.id] = entry.unreadCount
  }
  if (categories) {
    for (const category of categories) {
      for (const entry of category.channels) {
        map[entry.channel.id] = entry.unreadCount
      }
    }
  }
  return map
}

const buildInitialMentionMap = (
  ungroupedChannels: ChannelWithUnread[],
  categories?: CategoryWithChannels[],
): MentionMap => {
  const map: MentionMap = {}
  for (const entry of ungroupedChannels) {
    map[entry.channel.id] = entry.mentionCount
  }
  if (categories) {
    for (const category of categories) {
      for (const entry of category.channels) {
        map[entry.channel.id] = entry.mentionCount
      }
    }
  }
  return map
}

export const ServerSidebarClient = ({
  server,
  role,
  categories = [],
  ungroupedChannels = [],
  members,
  currentMemberId,
}: ServerSidebarClientProps) => {
  const { subscribe, unsubscribe } = UseRealtime()
  const { onOpen } = useModal()
  const router = useRouter()
  const params = useParams()
  const activeChannelId = typeof params?.channelId === "string" ? params.channelId : null
  const [unreadMap, setUnreadMap] = useState<UnreadMap>(() => buildInitialMap(ungroupedChannels, categories))
  const [mentionMap, setMentionMap] = useState<MentionMap>(() => buildInitialMentionMap(ungroupedChannels, categories))
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [collapsedMembers, setCollapsedMembers] = useState<boolean>(false)
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  // Optimistic state for drag-and-drop
  const [optimisticCategories, setOptimisticCategories] = useState<CategoryWithChannels[] | null>(null)
  const [optimisticUngroupedChannels, setOptimisticUngroupedChannels] = useState<ChannelWithUnread[] | null>(null)

  // Use optimistic state if available, otherwise use props
  const displayCategories = optimisticCategories ?? categories
  const displayUngroupedChannels = optimisticUngroupedChannels ?? ungroupedChannels
  const activeChannelIdRef = useRef<string | null>(activeChannelId)
  const lastMessageIdsRef = useRef<Record<string, string | undefined>>({})
  const processedMessageIdsRef = useRef<Record<string, { ids: Set<string>; order: string[] }>>({})
  const serverId = server.id

  const fetchUnreadCount = useCallback(async (channelId: string) => {
    if (!serverId) {
      return null
    }
    try {
      const query = new URLSearchParams({ serverId })
      const response = await fetch(`/api/channels/${channelId}/unread?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      if (!response.ok) {
        console.error(`[CHANNEL_UNREAD_FETCH_ERROR] Failed to fetch unread count for channel ${channelId}`, response.status)
        return null
      }
      const data = (await response.json()) as UnreadCountResponse
      return data
    } catch (error) {
      console.error("[CHANNEL_UNREAD_FETCH_ERROR]", error)
      return null
    }
  }, [serverId])

  const updateUnreadFromServer = useCallback(
    async (channelId: string, messageId?: string) => {
      const result = await fetchUnreadCount(channelId)
      if (!result) {
        return
      }
      const { unreadCount, mentionCount, lastMessageId } = result
      const messageIdentifier = messageId ?? (typeof lastMessageId === "string" ? lastMessageId : undefined)
      if (messageIdentifier) {
        lastMessageIdsRef.current[channelId] = messageIdentifier
      }
      setUnreadMap((prev) => {
        if ((prev[channelId] ?? 0) === unreadCount) {
          return prev
        }
        return {
          ...prev,
          [channelId]: unreadCount,
        }
      })
      setMentionMap((prev) => {
        if ((prev[channelId] ?? 0) === mentionCount) {
          return prev
        }
        return {
          ...prev,
          [channelId]: mentionCount,
        }
      })
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("guildhall:channel-unread-change", {
            detail: {
              channelId,
              unreadCount,
              mentionCount,
              hasUnread: unreadCount > 0,
              messageId: messageIdentifier,
            },
          }),
        )
      }
    },
    [fetchUnreadCount],
  )

  const trackMessage = (channelId: string, identifiers: (string | undefined)[]) => {
    const validIdentifiers = identifiers.filter((identifier): identifier is string => Boolean(identifier))
    if (!validIdentifiers.length) {
      return true
    }
    let tracker = processedMessageIdsRef.current[channelId]
    if (!tracker) {
      tracker = {
        ids: new Set<string>(),
        order: [],
      }
      processedMessageIdsRef.current[channelId] = tracker
    }
    const processed = validIdentifiers.some((identifier) => tracker.ids.has(identifier))
    if (processed) {
      return false
    }
    for (const identifier of validIdentifiers) {
      tracker.ids.add(identifier)
      tracker.order.push(identifier)
    }
    while (tracker.order.length > 100) {
      const oldest = tracker.order.shift()
      if (oldest) {
        tracker.ids.delete(oldest)
      }
    }
    return true
  }

  const allChannels = useMemo(
    () => [
      ...displayUngroupedChannels,
      ...displayCategories.flatMap((cat) => cat.channels),
    ].map((entry) => entry.channel),
    [displayUngroupedChannels, displayCategories],
  )

  useEffect(() => {
    // Reset optimistic state when props change (after server refresh)
    setOptimisticCategories(null)
    setOptimisticUngroupedChannels(null)

    const initialUnreadMap = buildInitialMap(ungroupedChannels, categories)
    const initialMentionMap = buildInitialMentionMap(ungroupedChannels, categories)
    const activeChannelIds = new Set(Object.keys(initialUnreadMap))

    setUnreadMap((prev) => {
      const next: UnreadMap = {}
      for (const [channelId, baselineCount] of Object.entries(initialUnreadMap)) {
        next[channelId] = prev[channelId] ?? baselineCount
      }
      return next
    })

    setMentionMap((prev) => {
      const next: MentionMap = {}
      for (const [channelId, baselineCount] of Object.entries(initialMentionMap)) {
        next[channelId] = prev[channelId] ?? baselineCount
      }
      return next
    })

    processedMessageIdsRef.current = Object.fromEntries(
      Object.entries(processedMessageIdsRef.current).filter(([channelId]) => activeChannelIds.has(channelId)),
    )
    lastMessageIdsRef.current = Object.fromEntries(
      Object.entries(lastMessageIdsRef.current).filter(([channelId]) => activeChannelIds.has(channelId)),
    )
  }, [ungroupedChannels, categories])

  // Load sidebar preferences from server when server changes
  useEffect(() => {
    let isMounted = true
    setIsLoadingPreferences(true)

    const loadPreferences = async () => {
      const savedState = await fetchSidebarPreferences(server.id)
      if (isMounted) {
        setCollapsedCategories(new Set(savedState.collapsedCategories))
        setCollapsedMembers(savedState.collapsedMembers)
        setIsLoadingPreferences(false)
      }
    }

    void loadPreferences()

    return () => {
      isMounted = false
    }
  }, [server.id])

  // Track mount state to prevent hydration mismatches
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId
    if (!activeChannelId) {
      return
    }
    setUnreadMap((prev) => {
      const currentCount = prev[activeChannelId] ?? 0
      if (currentCount === 0) {
        return prev
      }
      lastMessageIdsRef.current[activeChannelId] = undefined
      processedMessageIdsRef.current[activeChannelId] = {
        ids: new Set<string>(),
        order: [],
      }
      return {
        ...prev,
        [activeChannelId]: 0,
      }
    })
    setMentionMap((prev) => {
      const currentCount = prev[activeChannelId] ?? 0
      if (currentCount === 0) {
        return prev
      }
      return {
        ...prev,
        [activeChannelId]: 0,
      }
    })
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("guildhall:channel-unread-change", {
          detail: {
            channelId: activeChannelId,
            unreadCount: 0,
            mentionCount: 0,
            hasUnread: false,
            messageId: undefined,
          },
        }),
      )
    }
  }, [activeChannelId])

  useEffect(() => {
    const subscriptions = allChannels.map((channel) => {
      const eventKey = `chat:${channel.id}:messages`
      return subscribe(eventKey, eventKey, (payload) => {
        const message = payload.payload as ChatMessage
        if (!isChannelMessage(message) || message.channelId !== channel.id) {
          return
        }
        if (message.memberId === currentMemberId) {
          return
        }
        const messageId = typeof message.id === "string" ? message.id : undefined
        const broadcastId = typeof payload.meta?.id === "string" ? payload.meta.id : undefined
        const optimisticId = typeof message.optimisticId === "string" ? message.optimisticId : undefined
        let createdAtIdentifier: string | undefined
        const createdAtValue = message.createdAt
        if (createdAtValue instanceof Date) {
          createdAtIdentifier = `${channel.id}:${message.memberId}:${createdAtValue.toISOString()}`
        } else if (typeof createdAtValue === "string") {
          const parsed = new Date(createdAtValue)
          if (!Number.isNaN(parsed.getTime())) {
            createdAtIdentifier = `${channel.id}:${message.memberId}:${parsed.toISOString()}`
          }
        }
        if (
          !trackMessage(channel.id, [
            messageId,
            broadcastId,
            optimisticId,
            createdAtIdentifier,
          ])
        ) {
          return
        }
        if (messageId && lastMessageIdsRef.current[channel.id] === messageId) {
          return
        }
        const isActiveChannel = activeChannelIdRef.current === channel.id
        if (isActiveChannel) {
          if (messageId) {
            lastMessageIdsRef.current[channel.id] = messageId
          }
          setUnreadMap((prev) => {
            if ((prev[channel.id] ?? 0) === 0) {
              return prev
            }
            return {
              ...prev,
              [channel.id]: 0,
            }
          })
          setMentionMap((prev) => {
            if ((prev[channel.id] ?? 0) === 0) {
              return prev
            }
            return {
              ...prev,
              [channel.id]: 0,
            }
          })
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("guildhall:channel-unread-change", {
                detail: {
                  channelId: channel.id,
                  unreadCount: 0,
                  mentionCount: 0,
                  hasUnread: false,
                  messageId,
                },
              }),
            )
          }
          return
        }

        void updateUnreadFromServer(channel.id, messageId)
      })
    })

    return () => {
      subscriptions.forEach((subscription) => {
        if (subscription) {
          unsubscribe(subscription)
        }
      })
    }
  }, [allChannels, subscribe, unsubscribe, currentMemberId, updateUnreadFromServer])

  useEffect(() => {
    const handleChannelEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        channelId: string
        unreadCount?: number
        mentionCount?: number
        hasUnread?: boolean
        messageId?: string
      }>
      const channelId = customEvent.detail?.channelId
      if (!channelId) {
        return
      }
      const nextCount = customEvent.detail?.unreadCount ?? 0
      const nextMentionCount = customEvent.detail?.mentionCount ?? 0
      const messageId = customEvent.detail?.messageId
      trackMessage(channelId, [messageId])
      setUnreadMap((prev) => {
        if ((prev[channelId] ?? 0) === nextCount) {
          return prev
        }
        if (typeof messageId === "string") {
          lastMessageIdsRef.current[channelId] = messageId
        }
        return {
          ...prev,
          [channelId]: nextCount,
        }
      })
      setMentionMap((prev) => {
        if ((prev[channelId] ?? 0) === nextMentionCount) {
          return prev
        }
        return {
          ...prev,
          [channelId]: nextMentionCount,
        }
      })
    }

    window.addEventListener("guildhall:channel-unread-change", handleChannelEvent)
    window.addEventListener("guildhall:new-messages", handleChannelEvent)
    return () => {
      window.removeEventListener("guildhall:channel-unread-change", handleChannelEvent)
      window.removeEventListener("guildhall:new-messages", handleChannelEvent)
    }
  }, [])

  const getUnread = (channelId: string) => {
    if (activeChannelId === channelId) {
      return 0
    }
    return unreadMap[channelId] ?? 0
  }

  const getMentionCount = (channelId: string) => {
    if (activeChannelId === channelId) {
      return 0
    }
    return mentionMap[channelId] ?? 0
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id || role === MemberRole.MEMBER) {
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    try {
      // Check if dragging a category
      const activeCategory = categories.find((cat) => cat.id === activeId)
      const overCategory = categories.find((cat) => cat.id === overId)

      if (activeCategory && overCategory) {
        // Reordering categories
        const oldIndex = displayCategories.findIndex((cat) => cat.id === activeId)
        const newIndex = displayCategories.findIndex((cat) => cat.id === overId)
        const newCategories = arrayMove([...displayCategories], oldIndex, newIndex)

        // Optimistically update UI
        setOptimisticCategories(newCategories)

        // Update order for all affected categories in the background
        try {
          for (let i = 0; i < newCategories.length; i++) {
            await axios.patch(
              `/api/servers/${server.id}/categories/${newCategories[i].id}/reorder`,
              { order: i }
            )
          }
          router.refresh()
        } catch (error) {
          console.error("[DRAG_END_ERROR]", error)
          // Revert optimistic update on error
          setOptimisticCategories(null)
        }
        return
      }

      // Check if dragging a channel
      const allChannelsList = [
        ...displayUngroupedChannels,
        ...displayCategories.flatMap((cat) => cat.channels),
      ]
      const activeChannel = allChannelsList.find((entry) => entry.channel.id === activeId)
      const overChannel = allChannelsList.find((entry) => entry.channel.id === overId)

      // Check if dropping on a category header or ungrouped section
      const overCategoryHeader = displayCategories.find((cat) => cat.id === overId)
      const isDroppingOnUngrouped = overId === "ungrouped"

      // If dragging a channel and dropping on ungrouped section
      if (activeChannel && isDroppingOnUngrouped) {
        const sourceCategoryId = activeChannel.channel.categoryId || null

        // Add channel to ungrouped
        const updatedChannel = { ...activeChannel, channel: { ...activeChannel.channel, categoryId: null } }
        const newUngrouped = [...displayUngroupedChannels, updatedChannel]

        // Optimistically update UI
        setOptimisticUngroupedChannels(newUngrouped)

        // Update source category if moving from a category
        if (sourceCategoryId) {
          const updatedCategories = displayCategories.map((cat) =>
            cat.id === sourceCategoryId
              ? { ...cat, channels: cat.channels.filter((ch) => ch.channel.id !== activeId) }
              : cat
          )
          setOptimisticCategories(updatedCategories)
        }

        // Update in background
        try {
          await axios.patch(
            `/api/channels/${activeId}/category?serverId=${server.id}`,
            {
              categoryId: null,
              order: newUngrouped.length - 1,
            }
          )

          // Update source category orders if moving from a category
          if (sourceCategoryId) {
            const sourceCategory = displayCategories.find((cat) => cat.id === sourceCategoryId)
            if (sourceCategory) {
              const sourceChannels = sourceCategory.channels.filter(
                (entry) => entry.channel.id !== activeId
              )
              for (let i = 0; i < sourceChannels.length; i++) {
                await axios.patch(
                  `/api/channels/${sourceChannels[i].channel.id}/category?serverId=${server.id}`,
                  {
                    categoryId: sourceCategoryId,
                    order: i,
                  }
                )
              }
            }
          }

          router.refresh()
        } catch (error) {
          console.error("[DRAG_END_ERROR]", error)
          setOptimisticCategories(null)
          setOptimisticUngroupedChannels(null)
        }
        return
      }

      // If dragging a channel and dropping on a category header
      if (activeChannel && overCategoryHeader) {
        const sourceCategoryId = activeChannel.channel.categoryId || null
        const targetCategoryId = overCategoryHeader.id

        // Get channels in target category
        const targetCategoryChannels = overCategoryHeader.channels.filter(
          (entry) => entry.channel.id !== activeId
        )

        // Add channel to end of target category
        const reorderedChannels = [
          ...targetCategoryChannels,
          { ...activeChannel, channel: { ...activeChannel.channel, categoryId: targetCategoryId } },
        ]

        // Optimistically update UI
        const updatedCategories = displayCategories.map((cat) =>
          cat.id === targetCategoryId
            ? { ...cat, channels: reorderedChannels }
            : cat.id === sourceCategoryId
              ? { ...cat, channels: cat.channels.filter((ch) => ch.channel.id !== activeId) }
              : cat
        )
        setOptimisticCategories(updatedCategories)

        // Update ungrouped if moving from ungrouped
        if (sourceCategoryId === null) {
          setOptimisticUngroupedChannels(
            displayUngroupedChannels.filter((entry) => entry.channel.id !== activeId)
          )
        }

        // Update all channels in the target category with new orders in the background
        try {
          for (let i = 0; i < reorderedChannels.length; i++) {
            await axios.patch(
              `/api/channels/${reorderedChannels[i].channel.id}/category?serverId=${server.id}`,
              {
                categoryId: targetCategoryId,
                order: i,
              }
            )
          }

          // If moving from a different category, update the source category orders too
          if (sourceCategoryId !== null && sourceCategoryId !== targetCategoryId) {
            const sourceCategory = displayCategories.find((cat) => cat.id === sourceCategoryId)
            if (sourceCategory) {
              const sourceChannels = sourceCategory.channels.filter(
                (entry) => entry.channel.id !== activeId
              )
              for (let i = 0; i < sourceChannels.length; i++) {
                await axios.patch(
                  `/api/channels/${sourceChannels[i].channel.id}/category?serverId=${server.id}`,
                  {
                    categoryId: sourceCategoryId,
                    order: i,
                  }
                )
              }
            }
          } else if (sourceCategoryId === null && targetCategoryId !== null) {
            // Moving from ungrouped to category - update ungrouped channels
            const remainingUngrouped = displayUngroupedChannels.filter(
              (entry) => entry.channel.id !== activeId
            )

            for (let i = 0; i < remainingUngrouped.length; i++) {
              await axios.patch(
                `/api/channels/${remainingUngrouped[i].channel.id}/category?serverId=${server.id}`,
                {
                  categoryId: null,
                  order: i,
                }
              )
            }
          }

          router.refresh()
        } catch (error) {
          console.error("[DRAG_END_ERROR]", error)
          // Revert optimistic update on error
          setOptimisticCategories(null)
          setOptimisticUngroupedChannels(null)
        }
        return
      }

      if (activeChannel && overChannel) {
        // Moving channel within same category or between categories
        const targetCategoryId = overChannel.channel.categoryId || null
        const sourceCategoryId = activeChannel.channel.categoryId || null

        // Get channels in target category (sorted by current order)
        const targetCategoryChannels =
          targetCategoryId
            ? displayCategories.find((cat) => cat.id === targetCategoryId)?.channels || []
            : displayUngroupedChannels

        // Find the old and new indices
        const oldIndex = targetCategoryChannels.findIndex((entry) => entry.channel.id === activeId)
        const newIndex = targetCategoryChannels.findIndex((entry) => entry.channel.id === overId)

        // If moving within the same category
        if (targetCategoryId === sourceCategoryId && oldIndex !== -1 && newIndex !== -1) {
          // Reorder the array
          const reorderedChannels = arrayMove([...targetCategoryChannels], oldIndex, newIndex)

          // Optimistically update UI
          if (targetCategoryId) {
            const updatedCategories = displayCategories.map((cat) =>
              cat.id === targetCategoryId
                ? { ...cat, channels: reorderedChannels }
                : cat
            )
            setOptimisticCategories(updatedCategories)
          } else {
            // Update ungrouped channels optimistically
            const reordered = reorderedChannels.map((ch) => ({ ...ch, channel: { ...ch.channel, categoryId: null } }))
            setOptimisticUngroupedChannels(reordered)
          }

          // Update all channels in the new order in the background
          try {
            for (let i = 0; i < reorderedChannels.length; i++) {
              await axios.patch(
                `/api/channels/${reorderedChannels[i].channel.id}/category?serverId=${server.id}`,
                {
                  categoryId: targetCategoryId,
                  order: i,
                }
              )
            }
            router.refresh()
          } catch (error) {
            console.error("[DRAG_END_ERROR]", error)
            // Revert optimistic update on error
            setOptimisticCategories(null)
            setOptimisticUngroupedChannels(null)
          }
        } else {
          // Moving to a different category or from ungrouped to category
          // Remove the active channel from the list temporarily
          const channelsWithoutActive = targetCategoryChannels.filter(
            (entry) => entry.channel.id !== activeId
          )

          // Insert at the new position
          const insertIndex = newIndex >= 0 ? newIndex : channelsWithoutActive.length
          const reorderedChannels = [
            ...channelsWithoutActive.slice(0, insertIndex),
            { ...activeChannel, channel: { ...activeChannel.channel, categoryId: targetCategoryId } },
            ...channelsWithoutActive.slice(insertIndex),
          ]

          // Optimistically update UI
          if (targetCategoryId) {
            // Moving to a category
            const updatedCategories = displayCategories.map((cat) =>
              cat.id === targetCategoryId
                ? { ...cat, channels: reorderedChannels }
                : cat.id === sourceCategoryId
                  ? { ...cat, channels: cat.channels.filter((ch) => ch.channel.id !== activeId) }
                  : cat
            )
            setOptimisticCategories(updatedCategories)

            // Update ungrouped if moving from ungrouped
            if (sourceCategoryId === null) {
              setOptimisticUngroupedChannels(
                displayUngroupedChannels.filter((entry) => entry.channel.id !== activeId)
              )
            }
          } else {
            // Moving to ungrouped
            const updatedCategories = sourceCategoryId
              ? displayCategories.map((cat) =>
                cat.id === sourceCategoryId
                  ? { ...cat, channels: cat.channels.filter((ch) => ch.channel.id !== activeId) }
                  : cat
              )
              : displayCategories
            setOptimisticCategories(updatedCategories)

            // Add to ungrouped list
            const updatedChannel = { ...activeChannel, channel: { ...activeChannel.channel, categoryId: null } }
            const insertIdx = displayUngroupedChannels.findIndex((ch) => ch.channel.id === overId)
            const newUngrouped = insertIdx >= 0
              ? [
                ...displayUngroupedChannels.slice(0, insertIdx),
                updatedChannel,
                ...displayUngroupedChannels.slice(insertIdx),
              ]
              : [...displayUngroupedChannels, updatedChannel]
            setOptimisticUngroupedChannels(newUngrouped)
          }

          // Update all channels in the target category with new orders in the background
          try {
            for (let i = 0; i < reorderedChannels.length; i++) {
              await axios.patch(
                `/api/channels/${reorderedChannels[i].channel.id}/category?serverId=${server.id}`,
                {
                  categoryId: targetCategoryId,
                  order: i,
                }
              )
            }

            // If moving from a different category, update the source category orders too
            if (sourceCategoryId !== null && sourceCategoryId !== targetCategoryId) {
              const sourceCategory = displayCategories.find((cat) => cat.id === sourceCategoryId)
              if (sourceCategory) {
                const sourceChannels = sourceCategory.channels.filter(
                  (entry) => entry.channel.id !== activeId
                )
                for (let i = 0; i < sourceChannels.length; i++) {
                  await axios.patch(
                    `/api/channels/${sourceChannels[i].channel.id}/category?serverId=${server.id}`,
                    {
                      categoryId: sourceCategoryId,
                      order: i,
                    }
                  )
                }
              }
            } else if (sourceCategoryId === null && targetCategoryId !== null) {
              // Moving from ungrouped to category - update ungrouped channels
              const remainingUngrouped = displayUngroupedChannels.filter(
                (entry) => entry.channel.id !== activeId
              )

              for (let i = 0; i < remainingUngrouped.length; i++) {
                await axios.patch(
                  `/api/channels/${remainingUngrouped[i].channel.id}/category?serverId=${server.id}`,
                  {
                    categoryId: null,
                    order: i,
                  }
                )
              }
            }

            router.refresh()
          } catch (error) {
            console.error("[DRAG_END_ERROR]", error)
            // Revert optimistic update on error
            setOptimisticCategories(null)
            setOptimisticUngroupedChannels(null)
          }
        }
      }
    } catch (error) {
      console.error("[DRAG_END_ERROR]", error)
    }
  }

  const toggleCategoryCollapse = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const toggleMembersCollapse = () => {
    setCollapsedMembers((prev) => !prev)
  }

  // Save sidebar preferences to server whenever they change (debounced)
  useEffect(() => {
    if (isLoadingPreferences) {
      return // Don't save while loading initial state
    }

    const timeoutId = setTimeout(() => {
      void saveSidebarPreferences(server.id, {
        collapsedCategories: Array.from(collapsedCategories),
        collapsedMembers,
      })
    }, 300) // Debounce saves by 300ms

    return () => {
      clearTimeout(timeoutId)
    }
  }, [server.id, collapsedCategories, collapsedMembers, isLoadingPreferences])

  return (
    <div className="flex flex-col h-full w-full bg-lavender-200 dark:bg-background text-foreground border-r border-border/60">
      <ServerHeader server={server} role={role} />
      <ScrollArea className="flex-1 px-3 max-h-svh overflow-auto">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="h-full">
              <div className="mt-2">
                <ServerSearch
                  data={[
                    ...(ungroupedChannels.length > 0
                      ? [
                        {
                          label: "Ungrouped Channels",
                          type: "channel" as const,
                          data: ungroupedChannels.map(({ channel }) => ({
                            icon: iconMap[channel.type],
                            name: channel.name,
                            id: channel.id,
                          })),
                        },
                      ]
                      : []),
                    ...categories.flatMap((category) =>
                      category.channels.length > 0
                        ? [
                          {
                            label: category.name,
                            type: "channel" as const,
                            data: category.channels.map(({ channel }) => ({
                              icon: iconMap[channel.type],
                              name: channel.name,
                              id: channel.id,
                            })),
                          },
                        ]
                        : []
                    ),
                    {
                      label: "Members",
                      type: "member" as const,
                      data: members.map((member) => ({
                        icon: roleIconMap[member.role],
                        name: member.profile.name || member.profile.email,
                        id: member.id,
                      })),
                    },
                  ]}
                />
              </div>

              <Separator className="h-[2px] bg-border rounded-md my-4" />

              {isMounted && !isLoadingPreferences && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  {displayCategories.length > 0 && (
                    <SortableContext items={displayCategories.map((cat) => cat.id)} strategy={verticalListSortingStrategy}>
                      {displayCategories.map((category) => (
                        <ServerCategory
                          key={category.id}
                          category={{
                            ...category,
                            channels: category.channels.map(({ channel }) => ({
                              id: channel.id,
                              name: channel.name,
                              type: channel.type,
                            })),
                          }}
                          server={server}
                          role={role}
                          isCollapsed={collapsedCategories.has(category.id)}
                          onToggleCollapse={() => toggleCategoryCollapse(category.id)}
                        >
                          <SortableContext
                            items={category.channels.map((entry) => entry.channel.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {category.channels.map(({ channel }) => (
                              <ServerChannel
                                key={channel.id}
                                channel={channel}
                                server={server}
                                role={role}
                                unreadCount={getUnread(channel.id)}
                                mentionCount={getMentionCount(channel.id)}
                                categories={categories.map((cat) => ({ id: cat.id, name: cat.name }))}
                              />
                            ))}
                          </SortableContext>
                        </ServerCategory>
                      ))}
                    </SortableContext>
                  )}

                  {(() => {
                    const UngroupedSection = () => {
                      const { setNodeRef, isOver } = useDroppable({
                        id: "ungrouped",
                      })

                      if (displayUngroupedChannels.length === 0 && !isOver) {
                        return null
                      }

                      return (
                        <div className="mb-2" ref={setNodeRef}>
                          <div
                            className={cn(
                              "flex items-center justify-between py-2 px-2 rounded-md cursor-default",
                              isOver && "bg-muted/60"
                            )}
                          >
                            <p className="text-xs uppercase font-semibold text-muted-foreground">
                              Ungrouped
                            </p>
                          </div>
                          {displayUngroupedChannels.length > 0 && (
                            <SortableContext
                              items={displayUngroupedChannels.map((entry) => entry.channel.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="pl-2">
                                {displayUngroupedChannels.map(({ channel }) => (
                                  <ServerChannel
                                    key={channel.id}
                                    channel={channel}
                                    server={server}
                                    role={role}
                                    unreadCount={getUnread(channel.id)}
                                    mentionCount={getMentionCount(channel.id)}
                                    categories={displayCategories.map((cat) => ({ id: cat.id, name: cat.name }))}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          )}
                        </div>
                      )
                    }

                    return <UngroupedSection />
                  })()}
                </DndContext>
              )}

              <Separator className="h-[2px] bg-border rounded-md my-4" />

              {!!members?.length && (
                <div className="mb-4">
                  <div
                    className={cn(
                      "flex items-center justify-between py-2 px-2 rounded-md group cursor-pointer hover:bg-muted/60 transition",
                      !collapsedMembers && "mb-1"
                    )}
                    onClick={toggleMembersCollapse}
                  >
                    <div className="flex items-center gap-x-1 flex-1 min-w-0">
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-150", collapsedMembers ? "-rotate-90" : "rotate-0")} />
                      <p className="text-xs uppercase font-semibold text-muted-foreground truncate tracking-wide">
                        Members
                      </p>
                    </div>
                    {role === MemberRole.ADMIN && (
                      <div className="ml-auto flex items-center gap-x-2 flex-shrink-0">
                        <ActionTooltip label="Manage Members" side="top">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpen("members", { server })
                            }}
                            className="hidden group-hover:block text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </ActionTooltip>
                      </div>
                    )}
                  </div>
                  {!collapsedMembers && (
                    <div className="pl-2">
                      {members.map((member) => (
                        <ServerMember key={member.id} member={member} server={server} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ContextMenuTrigger>
          {role !== MemberRole.MEMBER && (
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onOpen("createCategory", { server })}>
                <Plus className="w-4 h-4 mr-2" />
                <span>Create Category</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onOpen("createChannel", { server })}>
                <Plus className="w-4 h-4 mr-2" />
                <span>Create Channel</span>
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>
      </ScrollArea>
    </div>
  )
}

