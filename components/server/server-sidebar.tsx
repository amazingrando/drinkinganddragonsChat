import { ChannelType } from '@prisma/client'
import { redirect } from 'next/navigation'
import { currentProfile } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { ServerSidebarClient } from '@/components/server/server-sidebar-client'
import { parseMarkdown } from '@/lib/markdown/parser'

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

  if (!server) {
    return redirect('/')
  }

  const textChannels = server.channels.filter((channel) => channel.type === ChannelType.TEXT)
  const audioChannels = server.channels.filter((channel) => channel.type === ChannelType.AUDIO)
  const videoChannels = server.channels.filter((channel) => channel.type === ChannelType.VIDEO)

  const members = server.members.filter((member) => member.profileID !== profile.id)

  const currentMember = server.members.find((member) => member.profileID === profile.id)
  const role = currentMember?.role

  const readStatesPromise = currentMember
    ? db.channelReadState.findMany({
      where: { memberId: currentMember.id },
      select: {
        channelId: true,
        lastReadAt: true,
      },
    })
    : Promise.resolve([])

  const readStates = await readStatesPromise

  const readByChannel = new Map(readStates.map((state) => [state.channelId, state]))

  const unreadConditions = server.channels.map((channel) => {
    const readState = readByChannel.get(channel.id)
    if (!readState || !readState.lastReadAt) {
      return { channelId: channel.id }
    }
    return {
      channelId: channel.id,
      createdAt: {
        gt: readState.lastReadAt,
      },
    }
  })

  const unreadGroups = unreadConditions.length
    ? await db.message.groupBy({
      by: ['channelId'],
      where: {
        OR: unreadConditions,
      },
      _count: {
        channelId: true,
      },
    })
    : []

  const unreadCountByChannel = new Map(unreadGroups.map((group) => [group.channelId, group._count.channelId]))

  const unreadCountForChannel = (channelId: string) => unreadCountByChannel.get(channelId) ?? 0

  // Calculate mention counts for each channel
  const mentionCountByChannel = new Map<string, number>()
  
  for (const channel of server.channels) {
    const readState = readByChannel.get(channel.id)
    const unreadCount = unreadCountForChannel(channel.id)
    
    if (unreadCount === 0) {
      mentionCountByChannel.set(channel.id, 0)
      continue
    }

    // Get unread messages for this channel
    const unreadMessages = await db.message.findMany({
      where: {
        channelId: channel.id,
        deleted: false,
        ...(readState?.lastReadAt
          ? {
              createdAt: {
                gt: readState.lastReadAt,
              },
            }
          : {}),
      },
      select: {
        content: true,
      },
    })

    // Count mentions of the current user
    // Note: Mentions store member IDs, not profile IDs
    let mentionCount = 0
    if (currentMember) {
      for (const message of unreadMessages) {
        const tokens = parseMarkdown(message.content)
        
        // Recursively check all tokens for user mentions
        const checkTokens = (tokens: ReturnType<typeof parseMarkdown>) => {
          for (const token of tokens) {
            if (token.type === "mention" && token.mentionType === "user" && token.mentionId === currentMember.id) {
              mentionCount++
            } else if (token.type === "bold" || token.type === "italic" || token.type === "spoiler" || token.type === "quote") {
              // Recursively check nested tokens
              checkTokens(token.content)
            }
          }
        }
        
        checkTokens(tokens)
      }
    }
    
    mentionCountByChannel.set(channel.id, mentionCount)
  }

  const mentionCountForChannel = (channelId: string) => mentionCountByChannel.get(channelId) ?? 0

  return (
    <ServerSidebarClient
      server={server}
      role={role}
      textChannels={textChannels.map((channel) => ({ 
        channel, 
        unreadCount: unreadCountForChannel(channel.id),
        mentionCount: mentionCountForChannel(channel.id),
      }))}
      audioChannels={audioChannels.map((channel) => ({ 
        channel, 
        unreadCount: unreadCountForChannel(channel.id),
        mentionCount: mentionCountForChannel(channel.id),
      }))}
      videoChannels={videoChannels.map((channel) => ({ 
        channel, 
        unreadCount: unreadCountForChannel(channel.id),
        mentionCount: mentionCountForChannel(channel.id),
      }))}
      members={members}
      currentMemberId={currentMember?.id ?? null}
    />
  )
}

export default ServerSidebar