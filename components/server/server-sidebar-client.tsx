"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Channel, ChannelType, Member, MemberRole, Profile, Server } from "@prisma/client"
import { UseRealtime } from "@/components/providers/realtime-provider"
import { Separator } from "@/components/ui/separator"
import { ServerHeader } from "@/components/server/server-header"
import { ScrollArea } from "@radix-ui/react-scroll-area"
import { ServerSearch } from "@/components/server/server-search"
import { ServerSection } from "@/components/server/server-section"
import { ServerChannel } from "@/components/server/server-channel"
import { ServerMember } from "@/components/server/server-member"
import { Hash, Mic, ShieldAlert, ShieldCheck, Users, Video } from "lucide-react"
import { ChatMessage } from "@/types"
import { useParams } from "next/navigation"

type ChannelWithUnread = {
  channel: Channel
  hasUnread: boolean
}

type ServerSidebarClientProps = {
  server: Server
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

type UnreadMap = Record<string, boolean>

const buildInitialMap = (
  textChannels: ChannelWithUnread[],
  audioChannels: ChannelWithUnread[],
  videoChannels: ChannelWithUnread[],
): UnreadMap => {
  const map: UnreadMap = {}
  for (const entry of [...textChannels, ...audioChannels, ...videoChannels]) {
    map[entry.channel.id] = entry.hasUnread
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

  const allChannels = useMemo(
    () => [...textChannels, ...audioChannels, ...videoChannels].map((entry) => entry.channel),
    [textChannels, audioChannels, videoChannels],
  )

  useEffect(() => {
    setUnreadMap(buildInitialMap(textChannels, audioChannels, videoChannels))
  }, [textChannels, audioChannels, videoChannels])

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId
    if (!activeChannelId) {
      return
    }
    setUnreadMap((prev) => {
      if (!prev[activeChannelId]) {
        return prev
      }
      return {
        ...prev,
        [activeChannelId]: false,
      }
    })
  }, [activeChannelId])

  useEffect(() => {
    const subscriptions = allChannels.map((channel) => {
      const eventKey = `chat:${channel.id}:messages`
      return subscribe(eventKey, eventKey, (payload) => {
        const message = payload.payload as ChatMessage
        if (message?.channelId !== channel.id) {
          return
        }
        if (message.memberId === currentMemberId) {
          return
        }
        setUnreadMap((prev) => {
          const alreadyUnread = prev[channel.id] ?? false
          const nextUnread = activeChannelIdRef.current === channel.id ? false : true
          if (alreadyUnread === nextUnread) {
            return prev
          }
          const next = {
            ...prev,
            [channel.id]: nextUnread,
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("guildhall:channel-unread-change", {
                detail: {
                  channelId: channel.id,
                  hasUnread: nextUnread,
                },
              }),
            )
          }
          return next
        })
      })
    })

    return () => {
      subscriptions.forEach((subscription) => {
        if (subscription) {
          unsubscribe(subscription)
        }
      })
    }
  }, [allChannels, subscribe, unsubscribe, currentMemberId])

  useEffect(() => {
    const handleChannelEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ channelId: string; hasUnread?: boolean }>
      const channelId = customEvent.detail?.channelId
      if (!channelId) {
        return
      }
      const nextUnread = customEvent.detail?.hasUnread ?? false
      setUnreadMap((prev) => {
        if ((prev[channelId] ?? false) === nextUnread) {
          return prev
        }
        return {
          ...prev,
          [channelId]: nextUnread,
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
      return false
    }
    return unreadMap[channelId] ?? false
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
                data: textChannels?.map(({ channel }) => ({
                  icon: iconMap[channel.type],
                  name: channel.name,
                  id: channel.id,
                })),
              },
              {
                label: "Voice Channels",
                type: "channel",
                data: audioChannels?.map(({ channel }) => ({
                  icon: iconMap[channel.type],
                  name: channel.name,
                  id: channel.id,
                })),
              },
              {
                label: "Video Channels",
                type: "channel",
                data: videoChannels?.map(({ channel }) => ({
                  icon: iconMap[channel.type],
                  name: channel.name,
                  id: channel.id,
                })),
              },
              {
                label: "Members",
                type: "member",
                data: members?.map((member) => ({
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
                hasUnread={getUnread(channel.id)}
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
                hasUnread={getUnread(channel.id)}
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
                hasUnread={getUnread(channel.id)}
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

