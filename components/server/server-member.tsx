"use client"

import { cn } from "@/lib/utils"
import { Member, Profile, Server } from "@prisma/client"
import { useParams, useRouter } from "next/navigation"
import UserAvatar from "@/components/user-avatar"
import { RoleIcon } from "@/components/role-icon"

interface ServerMemberProps {
  member: Member & { profile: Profile }
  server: Server
}

export const ServerMember = ({ member }: ServerMemberProps) => {
  const params = useParams()
  const router = useRouter()

  const onClick = () => {
    router.push(`/servers/${params?.serverId}/conversations/${member.id}`)
  }

  return (
    <button onClick={onClick} className={cn("group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-muted/60 transition mb-1",
      params?.memberId === member.id && "bg-zinc-700/20 dark:bg-zinc-700",
    )}>
      <UserAvatar src={member.profile.email} className="h-6 w-6 md:h-6 md:w-6" />
      <p className={cn("font-semibold text-sm whitespace-nowrap text-ellipsis max-w-full overflow-hidden transition text-muted-foreground group-hover:text-foreground",
        params?.memberId === member.id && "text-muted-foreground ",
      )}>
        {member.profile.name}
      </p>
      <RoleIcon role={member.role} />
    </button>
  )
}