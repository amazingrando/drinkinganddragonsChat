import { currentProfile } from "@/lib/current-profile"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import ChatHeader from "@/components/chat/chat-header"
import { ChatInput } from "@/components/chat/chat-input"

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
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader serverId={channel.serverID} name={channel.name} type="channel" />
      <div className="flex-1">
        Future messages
      </div>
      <ChatInput apiUrl="/api/socket/messages" query={{ channelId: channel.id, serverId: channel.serverID }} name={channel.name} type="channel" />
    </div>
  )
}

export default ChannelIdPage