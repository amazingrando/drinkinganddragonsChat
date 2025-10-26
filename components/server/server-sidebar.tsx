import { ChannelType, MemberRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import { currentProfile } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { ServerHeader } from '@/components/server/server-header'
import { ScrollArea } from '@radix-ui/react-scroll-area'
import { ServerSearch } from '@/components/server/server-search'
import { Hash, Mic, ShieldAlert, ShieldCheck, Users, Video } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ServerSection } from '@/components/server/server-section'
import { ServerChannel } from '@/components/server/server-channel'
import { ServerMember } from '@/components/server/server-member'

interface ServerSidebarProps {
  serverId: string
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

  const role = server?.members.find((member) => member.profileID === profile?.id)?.role

  return (
    <div className="flex flex-col h-full w-full bg-lavender-1000 text-foreground">

      <ServerHeader server={server} role={role} />
      <ScrollArea className="flex-1 px-3">
        <div className="mt-2">
          <ServerSearch
            data={[
              {
                label: "Text Channels",
                type: "channel",
                data: textChannels?.map((channel) => ({
                  icon: iconMap[channel.type],
                  name: channel.name,
                  id: channel.id,
                })),
              },
              {
                label: "Voice Channels",
                type: "channel",
                data: audioChannels?.map((channel) => ({
                  icon: iconMap[channel.type],
                  name: channel.name,
                  id: channel.id,
                })),
              },
              {
                label: "Video Channels",
                type: "channel",
                data: videoChannels?.map((channel) => ({
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
            ]} />
        </div>

        <Separator className="h-[2px] bg-zinc-200 dark:bg-zinc-700 rounded-md my-4" />
        {!!textChannels?.length && (
          <div className="mb-4">
            <ServerSection label="Text Channels" sectionType="channels" channelType={ChannelType.TEXT} role={role} />
            {textChannels.map((channel) => (
              <ServerChannel key={channel.id} channel={channel} server={server} role={role} />
            ))}
          </div>
        )}
        {!!audioChannels?.length && (
          <div className="mb-4">
            <ServerSection label="Voice Channels" sectionType="channels" channelType={ChannelType.AUDIO} role={role} />
            {audioChannels.map((channel) => (
              <ServerChannel key={channel.id} channel={channel} server={server} role={role} />
            ))}
          </div>
        )}
        {!!videoChannels?.length && (
          <div className="mb-4">
            <ServerSection label="Video Channels" sectionType="channels" channelType={ChannelType.VIDEO} role={role} />
            {videoChannels.map((channel) => (
              <ServerChannel key={channel.id} channel={channel} server={server} role={role} />
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

export default ServerSidebar