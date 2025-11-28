"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Channel, ChannelType, Member, MemberRole, Profile, ChannelCategory } from "@prisma/client"
import { UseRealtime } from "@/components/providers/realtime-provider"
import { Separator } from "@/components/ui/separator"
import { ServerHeader } from "@/components/server/server-header"
import { ScrollArea } from "@radix-ui/react-scroll-area"
import { ServerSearch } from "@/components/server/server-search"
import { ServerSection } from "@/components/server/server-section"
import { ServerChannel } from "@/components/server/server-channel"
import { ServerMember } from "@/components/server/server-member"
import { ServerCategory } from "@/components/server/server-category"
import { Hash, Mic, ShieldAlert, ShieldCheck, Users, Video, Plus } from "lucide-react"
import { ChatMessage, MessageWithPoll, ServerWithMembersWithProfiles } from "@/types"
import { useParams } from "next/navigation"
import { useModal } from "@/hooks/use-modal-store"
import { ActionTooltip } from "@/components/action-tooltip"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
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
  textChannels: ChannelWithUnread[]
  audioChannels: ChannelWithUnread[]
  videoChannels: ChannelWithUnread[]
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

const isChannelMessage = (message: ChatMessage | undefined): message is MessageWithPoll => {
  return Boolean(message && "channelId" in message)
}

const buildInitialMap = (
  textChannels: ChannelWithUnread[],
  audioChannels: ChannelWithUnread[],
  videoChannels: ChannelWithUnread[],
  categories?: CategoryWithChannels[],
): UnreadMap => {
  const map: UnreadMap = {}
  for (const entry of [...textChannels, ...audioChannels, ...videoChannels]) {
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
  textChannels: ChannelWithUnread[],
  audioChannels: ChannelWithUnread[],
  videoChannels: ChannelWithUnread[],
  categories?: CategoryWithChannels[],
): MentionMap => {
  const map: MentionMap = {}
  for (const entry of [...textChannels, ...audioChannels, ...videoChannels]) {
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
  textChannels,
  audioChannels,
  videoChannels,
  members,
  currentMemberId,
}: ServerSidebarClientProps) => {
  const { subscribe, unsubscribe } = UseRealtime()
  const { onOpen } = useModal()
  const router = useRouter()
  const params = useParams()
  const activeChannelId = typeof params?.channelId === "string" ? params.channelId : null
  const [unreadMap, setUnreadMap] = useState<UnreadMap>(() => buildInitialMap(textChannels, audioChannels, videoChannels, categories))
  const [mentionMap, setMentionMap] = useState<MentionMap>(() => buildInitialMentionMap(textChannels, audioChannels, videoChannels, categories))
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
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
      ...textChannels,
      ...audioChannels,
      ...videoChannels,
      ...categories.flatMap((cat) => cat.channels),
    ].map((entry) => entry.channel),
    [textChannels, audioChannels, videoChannels, categories],
  )

  useEffect(() => {
    const initialUnreadMap = buildInitialMap(textChannels, audioChannels, videoChannels, categories)
    const initialMentionMap = buildInitialMentionMap(textChannels, audioChannels, videoChannels, categories)
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
  }, [textChannels, audioChannels, videoChannels, categories])

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
        const oldIndex = categories.findIndex((cat) => cat.id === activeId)
        const newIndex = categories.findIndex((cat) => cat.id === overId)
        const newCategories = arrayMove(categories, oldIndex, newIndex)

        // Update order for all affected categories
        for (let i = 0; i < newCategories.length; i++) {
          await axios.patch(
            `/api/servers/${server.id}/categories/${newCategories[i].id}/reorder`,
            { order: i }
          )
        }

        router.refresh()
        return
      }

      // Check if dragging a channel
      const allChannelsList = [
        ...textChannels,
        ...audioChannels,
        ...videoChannels,
        ...categories.flatMap((cat) => cat.channels),
      ]
      const activeChannel = allChannelsList.find((entry) => entry.channel.id === activeId)
      const overChannel = allChannelsList.find((entry) => entry.channel.id === overId)

      if (activeChannel && overChannel) {
        // Moving channel within same category or between categories
        const targetCategoryId = overChannel.channel.categoryId || null
        const sourceCategoryId = activeChannel.channel.categoryId || null

        // Get channels in target category (sorted by current order)
        const targetCategoryChannels =
          targetCategoryId
            ? categories.find((cat) => cat.id === targetCategoryId)?.channels || []
            : [...textChannels, ...audioChannels, ...videoChannels]

        // Find the old and new indices
        const oldIndex = targetCategoryChannels.findIndex((entry) => entry.channel.id === activeId)
        const newIndex = targetCategoryChannels.findIndex((entry) => entry.channel.id === overId)

        // If moving within the same category
        if (targetCategoryId === sourceCategoryId && oldIndex !== -1 && newIndex !== -1) {
          // Reorder the array
          const reorderedChannels = arrayMove(targetCategoryChannels, oldIndex, newIndex)
          
          // Update all channels in the new order
          for (let i = 0; i < reorderedChannels.length; i++) {
            await axios.patch(
              `/api/channels/${reorderedChannels[i].channel.id}/category?serverId=${server.id}`,
              {
                categoryId: targetCategoryId,
                order: i,
              }
            )
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
            activeChannel,
            ...channelsWithoutActive.slice(insertIndex),
          ]

          // Update all channels in the target category with new orders
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
            const sourceCategory = categories.find((cat) => cat.id === sourceCategoryId)
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
            const ungroupedChannels = [
              ...textChannels,
              ...audioChannels,
              ...videoChannels,
            ].filter((entry) => entry.channel.id !== activeId)
            
            // Recalculate orders for ungrouped channels by type
            let textOrder = 0
            let audioOrder = 0
            let videoOrder = 0
            
            for (const entry of ungroupedChannels) {
              const order = entry.channel.type === ChannelType.TEXT 
                ? textOrder++ 
                : entry.channel.type === ChannelType.AUDIO 
                ? audioOrder++ 
                : videoOrder++
              
              await axios.patch(
                `/api/channels/${entry.channel.id}/category?serverId=${server.id}`,
                {
                  categoryId: null,
                  order,
                }
              )
            }
          }
        }

        router.refresh()
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

  return (
    <div className="flex flex-col h-full w-full bg-lavender-200 dark:bg-background text-foreground border-r border-border/60">
      <ServerHeader server={server} role={role} />
      <ScrollArea className="flex-1 px-3 max-h-svh overflow-auto">
        <div className="mt-2">
          <ServerSearch
            data={[
              {
                label: "Text Channels",
                type: "channel",
                data: textChannels.map(({ channel }) => ({
                  icon: iconMap[channel.type],
                  name: channel.name,
                  id: channel.id,
                })),
              },
              {
                label: "Voice Channels",
                type: "channel",
                data: audioChannels.map(({ channel }) => ({
                  icon: iconMap[channel.type],
                  name: channel.name,
                  id: channel.id,
                })),
              },
              {
                label: "Video Channels",
                type: "channel",
                data: videoChannels.map(({ channel }) => ({
                  icon: iconMap[channel.type],
                  name: channel.name,
                  id: channel.id,
                })),
              },
              {
                label: "Members",
                type: "member",
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

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {categories.length > 0 && (
            <SortableContext items={categories.map((cat) => cat.id)} strategy={verticalListSortingStrategy}>
              {categories.map((category) => (
                <ServerCategory
                  key={category.id}
                  category={category}
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

          {role !== MemberRole.MEMBER && categories.length > 0 && (
            <div className="mb-2 px-2">
              <ActionTooltip label="Create Category" side="top">
                <button
                  onClick={() => onOpen("createCategory", { server })}
                  className="text-muted-foreground hover:text-foreground transition text-xs uppercase font-semibold flex items-center gap-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Category</span>
                </button>
              </ActionTooltip>
            </div>
          )}

          {!!textChannels?.length && (
            <div className="mb-4">
              <ServerSection label="Text Channels" sectionType="channels" channelType={ChannelType.TEXT} role={role} server={server} />
              <SortableContext
                items={textChannels.map((entry) => entry.channel.id)}
                strategy={verticalListSortingStrategy}
              >
                {textChannels.map(({ channel }) => (
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
            </div>
          )}

          {!!audioChannels?.length && (
            <div className="mb-4">
              <ServerSection label="Voice Channels" sectionType="channels" channelType={ChannelType.AUDIO} role={role} server={server} />
              <SortableContext
                items={audioChannels.map((entry) => entry.channel.id)}
                strategy={verticalListSortingStrategy}
              >
                {audioChannels.map(({ channel }) => (
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
            </div>
          )}

          {!!videoChannels?.length && (
            <div className="mb-4">
              <ServerSection label="Video Channels" sectionType="channels" channelType={ChannelType.VIDEO} role={role} server={server} />
              <SortableContext
                items={videoChannels.map((entry) => entry.channel.id)}
                strategy={verticalListSortingStrategy}
              >
                {videoChannels.map(({ channel }) => (
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
            </div>
          )}
        </DndContext>

        {!!members?.length && (
          <div className="mb-4">
            <ServerSection label="Members" sectionType="members" role={role} server={server} />
            {members.map((member) => (
              <ServerMember key={member.id} member={member} server={server} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

