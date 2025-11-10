import type { Metadata } from "next"
import { currentProfile } from "@/lib/current-profile"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import ChatHeader from "@/components/chat/chat-header"
import { ChatInput } from "@/components/chat/chat-input"
import ChatMessages from "@/components/chat/chat-messages"
import { ChannelType } from "@prisma/client"
import { MediaRoom } from "@/components/media-room"

interface ChannelIdPageProps {
  params: Promise<{ serverId: string, channelId: string }>
}

export async function generateMetadata({ params }: ChannelIdPageProps): Promise<Metadata> {
  const { serverId, channelId } = await params
  const channel = await db.channel.findUnique({ where: { id: channelId } })
  const server = await db.server.findUnique({ where: { id: serverId } })
  const serverName = server?.name ?? 'Server'
  const channelName = channel?.name ?? 'Channel'
  return {
    title: `Guildhall → #${channelName} @ ${serverName}`,
    description: "Connect and collaborate with your TTRPG gaming community",
  }
}

const ChannelIdPage = async ({ params }: ChannelIdPageProps) => {

  const profile = await currentProfile()

  if (!profile) {
    return redirect('/sign-in')
  }

  const channel = await db.channel.findUnique({
    where: {
      id: (await params).channelId,
    },
  })

  const member = await db.member.findFirst({
    where: {
      serverID: (await params).serverId,
      profileID: profile.id,
    },
    include: {
      profile: true,
    },
  })

  if (!channel || !member) {
    return redirect('/')
  }

  const [readState, latestMessage] = await Promise.all([
    db.channelReadState.findUnique({
      where: {
        memberId_channelId: {
          memberId: member.id,
          channelId: channel.id,
        },
      },
    }),
    db.message.findFirst({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
      },
    }),
  ])

  const hasUnread = latestMessage
    ? !readState || latestMessage.createdAt > readState.lastReadAt
    : false

  const unreadCount = hasUnread
    ? await db.message.count({
      where: {
        channelId: channel.id,
        ...(readState?.lastReadAt
          ? {
            createdAt: {
              gt: readState.lastReadAt,
            },
          }
          : {}),
      },
    })
    : 0

  return (
    <div className="bg-lavender-100 dark:bg-lavender-900 text-foreground flex flex-col h-full">
      <ChatHeader serverId={channel.serverID} name={channel.name} type="channel" />
      {channel.type === ChannelType.TEXT && (
        <>
          <ChatMessages
            name={channel.name}
            member={member}
            chatId={channel.id}
            apiUrl="/api/messages"
            socketUrl="/api/socket/messages"
            socketQuery={{ channelId: channel.id, serverId: channel.serverID }}
            paramKey="channelId"
            paramValue={channel.id}
            type="channel"
            serverId={channel.serverID}
            initialReadState={{
              lastReadAt: readState?.lastReadAt?.toISOString() ?? null,
              lastMessageId: readState?.lastMessageId ?? null,
              hasUnread,
              unreadCount,
            }}
          />
          <ChatInput apiUrl="/api/socket/messages" query={{ channelId: channel.id, serverId: channel.serverID }} name={channel.name} type="channel" chatId={channel.id} currentMember={member} />
        </>
      )}
      {channel.type === ChannelType.AUDIO && (
        <MediaRoom chatId={channel.id} video={false} audio={true} />
      )}
      {channel.type === ChannelType.VIDEO && (
        <MediaRoom chatId={channel.id} video={true} audio={true} />
      )}
    </div>
  )
}

export default ChannelIdPage