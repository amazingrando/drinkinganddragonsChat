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
  })

  if (!channel || !member) {
    return redirect('/')
  }

  return (
    <div className="bg-lavender-100 dark:bg-lavender-900 text-foreground flex flex-col h-full">
      <ChatHeader serverId={channel.serverID} name={channel.name} type="channel" />
      {channel.type === ChannelType.TEXT && (
        <>
          <ChatMessages name={channel.name} member={member} chatId={channel.id} apiUrl="/api/messages" socketUrl="/api/socket/messages" socketQuery={{ channelId: channel.id, serverId: channel.serverID }} paramKey="channelId" paramValue={channel.id} type="channel" />
          <ChatInput apiUrl="/api/socket/messages" query={{ channelId: channel.id, serverId: channel.serverID }} name={channel.name} type="channel" />
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