import ChatHeader from "@/components/chat/chat-header"
import { getOrCreateConversation } from "@/lib/conversation"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"

interface MemberIdPageProps {
  params: Promise<{ serverId: string, memberId: string }>
}

const MemberIdPage = async ({ params }: MemberIdPageProps) => {
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

  const { memberOne, memberTwo } = conversation
  const otherMember = memberOne.id === currentMember.id ? memberTwo : memberOne


  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader imageUrl={otherMember.profile.imageUrl} name={otherMember.profile.name} type="conversation" serverId={(await params).serverId} />
    </div>
  )
}

export default MemberIdPage