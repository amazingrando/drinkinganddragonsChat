"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useModal } from "@/hooks/use-modal-store"
import { ServerWithMembersWithProfiles } from "@/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import UserAvatar from "@/components/user-avatar"
import { Check, Loader2, MoreVertical, Shield, ShieldQuestion, ShieldCheck, User, Users, Trash, ShieldAlert } from "lucide-react"
import { MemberRole } from "@prisma/client"
import { useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu"
import qs from "query-string"
import axios from "axios"
import { useRouter } from "next/navigation"

const roleIconMap = {
  [MemberRole.ADMIN]: <ShieldAlert className="h-4 w-4 mr-2 text-indigo-500" />,
  [MemberRole.MODERATOR]: <ShieldCheck className="h-4 w-4 mr-2 text-purple-500" />,
  [MemberRole.MEMBER]: <Users className="h-4 w-4 mr-2 text-gray-500" />,
}

const MembersModal = () => {
  const router = useRouter()
  const { isOpen, type, onOpen, onClose, data } = useModal()
  const [loadingId, setLoadingId] = useState<string>("")

  const isModalOpen = isOpen && type === "members"
  const { server } = data as { server: ServerWithMembersWithProfiles }

  const onKick = async (memberId: string) => {
    try {
      setLoadingId(memberId)
      const url = qs.stringifyUrl({
        url: `/api/members/${memberId}`,
        query: {
          serverId: server?.id,
        },
      })

      const response = await axios.delete(url)

      router.refresh()
      onOpen("members", { server: response.data })

    } catch (error) {
      console.error(error)
    } finally {
      setLoadingId("")
    }
  }

  const handleRoleChange = async (memberId: string, role: MemberRole) => {
    setLoadingId(memberId)
    try {
      setLoadingId(memberId)
      const url = qs.stringifyUrl({
        url: `/api/members/${memberId}`,
        query: {
          serverId: server?.id,
        },
      })

      const response = await axios.patch(url, { role })

      router.refresh()
      onOpen("members", { server: response.data })

    } catch (error) {
      console.error(error)
    } finally {
      setLoadingId("")
    }
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">Manage Members</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {server?.members.length} members
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="mt-8 max-h-[480px] px-3">
          {server?.members.map((member) => (
            <div key={member.id} className="flex items-center gap-x-2">
              <UserAvatar src={member.profile.imageUrl} />
              <p className="text-sm text-muted-foreground flex items-center gap-x-2">
                {member.profile.name}
                {roleIconMap[member.role]}
              </p>
              <p className="text-xs text-muted-foreground">
                {member.profile.email}
              </p>
              {server?.profileID !== member.profileID && loadingId !== member.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <MoreVertical className="h-4 w-4 ml-auto" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="left">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="flex items-center">
                        <ShieldQuestion className="h-4 w-4 mr-2" />
                        <span>Manage Role</span>
                      </DropdownMenuSubTrigger>

                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => handleRoleChange(member.id, "MEMBER")}>
                            <Shield className="h-4 w-4 mr-2" /> Guest
                            {member.role === "MEMBER" && <Check className="h-4 w-4 ml-auto" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRoleChange(member.id, "MODERATOR")}>
                            <ShieldCheck className="h-4 w-4 mr-2" /> Moderator
                            {member.role === "MODERATOR" && <Check className="h-4 w-4 ml-auto" />}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => onKick(member.id)}>
                      <Trash className="h-4 w-4 mr-2" /> Remove Member
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {loadingId === member.id && (
                <Loader2 className="h-4 w-4 ml-auto animate-spin text-muted-foreground" />
              )}
            </div>
          ))}

        </ScrollArea>

      </DialogContent>
    </Dialog >
  )
}

export default MembersModal