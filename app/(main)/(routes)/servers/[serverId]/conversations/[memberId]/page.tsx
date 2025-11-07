import ChatHeader from "@/components/chat/chat-header"
import ChatMessages from "@/components/chat/chat-messages"
import ChatInput from "@/components/chat/chat-input"
import { getOrCreateConversation } from "@/lib/conversation"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { MediaRoom } from "@/components/media-room"

interface MemberIdPageProps {
  params: Promise<{ serverId: string, memberId: string }>
  searchParams: Promise<{ video: boolean }>
}

const MemberIdPage = async ({ params, searchParams }: MemberIdPageProps) => {
  const profile = await currentProfile()

  if (!profile) {
    return redirect('/sign-in')
  }

  const currentMember = await db.member.findFirst({
    where: {
      serverID: (await params).serverId,
      profileID: profile.id,
    },
    include: {
      profile: true,
    },
  })

  if (!currentMember) {
    return redirect('/')
  }

  const conversation = await getOrCreateConversation(currentMember.id, (await params).memberId)

  if (!conversation) {
    return redirect('/')
  }

  if (!conversation.id) {
    return redirect('/')
  }

  const { memberOne, memberTwo } = conversation
  const otherMember = memberOne.id === currentMember.id ? memberTwo : memberOne


  return (
    <div className="bg-lavender-100 dark:bg-lavender-900 text-foreground flex flex-col h-full">
      <ChatHeader imageUrl={otherMember.profile.imageUrl} name={otherMember.profile.name} type="conversation" serverId={(await params).serverId} />
      {(await searchParams).video && (
        <MediaRoom chatId={conversation.id} video={true} audio={true} />
      )}
      {!(await searchParams).video && (
        <>
          <ChatMessages
            member={currentMember}
            name={otherMember.profile.name}
            chatId={conversation.id}
            type="conversation"
            apiUrl="/api/direct-messages"
            paramKey="conversationId"
            paramValue={conversation.id}
            socketUrl="/api/socket/direct-messages"
            socketQuery={{
              conversationId: conversation.id,
            }}
          />
          <ChatInput
            name={otherMember.profile.name}
            type="conversation"
            apiUrl="/api/socket/direct-messages"
            query={{
              conversationId: conversation.id,
            }}
            chatId={conversation.id}
            currentMember={currentMember}
          />
        </>
      )}
    </div>
  )
}

export default MemberIdPage