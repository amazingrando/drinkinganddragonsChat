import { ChannelType, MemberRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import { currentProfile } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { ServerSidebarClient } from '@/components/server/server-sidebar-client'

interface ServerSidebarProps {
  serverId: string
}

export const ServerSidebar = async ({ serverId }: ServerSidebarProps) => {
  const profile = await currentProfile()

  if (!profile) {
    return redirect('/sign-in')
  }

  const server = await db.server.findUnique({
    where: {
      id: serverId,
    },
    include: {
      channels: {
        orderBy: {
          createdAt: 'asc',
        },
      },
      members: {
        include: {
          profile: true,
        },
        orderBy: {
          role: 'asc',
        },
      },
    },
  })

  const textChannels = server?.channels.filter((channel) => channel.type === ChannelType.TEXT)
  const audioChannels = server?.channels.filter((channel) => channel.type === ChannelType.AUDIO)
  const videoChannels = server?.channels.filter((channel) => channel.type === ChannelType.VIDEO)

  const members = server?.members.filter((member) => member.profileID !== profile?.id)

  if (!server) {
    return redirect('/')
  }

  const currentMember = server.members.find((member) => member.profileID === profile.id)
  const role = currentMember?.role

  const channelIds = server.channels.map((channel) => channel.id)

  const readStatesPromise = currentMember
    ? db.channelReadState.findMany({
        where: { memberId: currentMember.id },
        select: {
          channelId: true,
          lastReadAt: true,
        },
      })
    : Promise.resolve([])

  const latestMessagesPromise = channelIds.length
    ? db.message.findMany({
        where: { channelId: { in: channelIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['channelId'],
        select: {
          channelId: true,
          createdAt: true,
        },
      })
    : Promise.resolve([])

  const [readStates, latestMessages] = await Promise.all([readStatesPromise, latestMessagesPromise])

  const readByChannel = new Map(readStates.map((state) => [state.channelId, state]))
  const latestByChannel = new Map(latestMessages.map((message) => [message.channelId, message]))

  const hasUnreadForChannel = (channelId: string) => {
    const latest = latestByChannel.get(channelId)
    if (!latest) {
      return false
    }

    const readState = readByChannel.get(channelId)
    if (!readState) {
      return true
    }

    return latest.createdAt > readState.lastReadAt
  }

  return (
    <ServerSidebarClient
      server={server}
      role={role}
      textChannels={textChannels.map((channel) => ({ channel, hasUnread: hasUnreadForChannel(channel.id) }))}
      audioChannels={audioChannels.map((channel) => ({ channel, hasUnread: hasUnreadForChannel(channel.id) }))}
      videoChannels={videoChannels.map((channel) => ({ channel, hasUnread: hasUnreadForChannel(channel.id) }))}
      members={members}
      currentMemberId={currentMember?.id ?? null}
    />
  )
}

export default ServerSidebar