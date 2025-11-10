"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Channel, ChannelType, Member, MemberRole, Profile } from "@prisma/client"
import { UseRealtime } from "@/components/providers/realtime-provider"
import { Separator } from "@/components/ui/separator"
import { ServerHeader } from "@/components/server/server-header"
import { ScrollArea } from "@radix-ui/react-scroll-area"
import { ServerSearch } from "@/components/server/server-search"
import { ServerSection } from "@/components/server/server-section"
import { ServerChannel } from "@/components/server/server-channel"
import { ServerMember } from "@/components/server/server-member"
import { Hash, Mic, ShieldAlert, ShieldCheck, Users, Video } from "lucide-react"
import { ChatMessage, MessageWithPoll, ServerWithMembersWithProfiles } from "@/types"
import { useParams } from "next/navigation"

type ChannelWithUnread = {
  channel: Channel
  unreadCount: number
}

type ServerSidebarClientProps = {
  server: ServerWithMembersWithProfiles
  role?: MemberRole
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

type UnreadCountResponse = {
  unreadCount: number
  lastMessageId?: string | null
}

const isChannelMessage = (message: ChatMessage | undefined): message is MessageWithPoll => {
  return Boolean(message && "channelId" in message)
}

const buildInitialMap = (
  textChannels: ChannelWithUnread[],
  audioChannels: ChannelWithUnread[],
  videoChannels: ChannelWithUnread[],
): UnreadMap => {
  const map: UnreadMap = {}
  for (const entry of [...textChannels, ...audioChannels, ...videoChannels]) {
    map[entry.channel.id] = entry.unreadCount
  }
  return map
}

export const ServerSidebarClient = ({
  server,
  role,
  textChannels,
  audioChannels,
  videoChannels,
  members,
  currentMemberId,
}: ServerSidebarClientProps) => {
  const { subscribe, unsubscribe } = UseRealtime()
  const params = useParams()
  const activeChannelId = typeof params?.channelId === "string" ? params.channelId : null
  const [unreadMap, setUnreadMap] = useState<UnreadMap>(() => buildInitialMap(textChannels, audioChannels, videoChannels))
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
      const { unreadCount, lastMessageId } = result
      setUnreadMap((prev) => {
        if ((prev[channelId] ?? 0) === unreadCount) {
          return prev
        }
        const messageIdentifier = messageId ?? (typeof lastMessageId === "string" ? lastMessageId : undefined)
        if (messageIdentifier) {
          lastMessageIdsRef.current[channelId] = messageIdentifier
        }
        const next = {
          ...prev,
          [channelId]: unreadCount,
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("guildhall:channel-unread-change", {
              detail: {
                channelId,
                unreadCount,
                hasUnread: unreadCount > 0,
                messageId: messageIdentifier,
              },
            }),
          )
        }
        return next
      })
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
    () => [...textChannels, ...audioChannels, ...videoChannels].map((entry) => entry.channel),
    [textChannels, audioChannels, videoChannels],
  )

  useEffect(() => {
    const initialUnreadMap = buildInitialMap(textChannels, audioChannels, videoChannels)
    const activeChannelIds = new Set(Object.keys(initialUnreadMap))

    setUnreadMap((prev) => {
      const next: UnreadMap = {}
      for (const [channelId, baselineCount] of Object.entries(initialUnreadMap)) {
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
  }, [textChannels, audioChannels, videoChannels])

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
      const next = {
        ...prev,
        [activeChannelId]: 0,
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("guildhall:channel-unread-change", {
            detail: {
              channelId: activeChannelId,
              unreadCount: 0,
              hasUnread: false,
              messageId: undefined,
            },
          }),
        )
      }
      return next
    })
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
            const next = {
              ...prev,
              [channel.id]: 0,
            }
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("guildhall:channel-unread-change", {
                  detail: {
                    channelId: channel.id,
                    unreadCount: 0,
                    hasUnread: false,
                    messageId,
                  },
                }),
              )
            }
            return next
          })
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
        hasUnread?: boolean
        messageId?: string
      }>
      const channelId = customEvent.detail?.channelId
      if (!channelId) {
        return
      }
      const nextCount = customEvent.detail?.unreadCount ?? 0
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

  return (
    <div className="flex flex-col h-full w-full bg-lavender-200 dark:bg-background text-foreground border-r border-border/60">
      <ServerHeader server={server} role={role} />
      <ScrollArea className="flex-1 px-3">
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
                  name: member.profile.name,
                  id: member.id,
                })),
              },
            ]}
          />
        </div>

        <Separator className="h-[2px] bg-border rounded-md my-4" />

        {!!textChannels?.length && (
          <div className="mb-4">
            <ServerSection label="Text Channels" sectionType="channels" channelType={ChannelType.TEXT} role={role} />
            {textChannels.map(({ channel }) => (
              <ServerChannel
                key={channel.id}
                channel={channel}
                server={server}
                role={role}
                unreadCount={getUnread(channel.id)}
              />
            ))}
          </div>
        )}

        {!!audioChannels?.length && (
          <div className="mb-4">
            <ServerSection label="Voice Channels" sectionType="channels" channelType={ChannelType.AUDIO} role={role} />
            {audioChannels.map(({ channel }) => (
              <ServerChannel
                key={channel.id}
                channel={channel}
                server={server}
                role={role}
                unreadCount={getUnread(channel.id)}
              />
            ))}
          </div>
        )}

        {!!videoChannels?.length && (
          <div className="mb-4">
            <ServerSection label="Video Channels" sectionType="channels" channelType={ChannelType.VIDEO} role={role} />
            {videoChannels.map(({ channel }) => (
              <ServerChannel
                key={channel.id}
                channel={channel}
                server={server}
                role={role}
                unreadCount={getUnread(channel.id)}
              />
            ))}
          </div>
        )}

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

