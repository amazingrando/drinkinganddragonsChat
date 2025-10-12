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
import { UserAvatar } from "@clerk/nextjs"

const MembersModal = () => {
  const { isOpen, type, onOpen, onClose, data } = useModal()

  const isModalOpen = isOpen && type === "members"
  const { server } = data as { server: ServerWithMembersWithProfiles }
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
              <p className="text-sm text-muted-foreground">{member.profile.name}</p>
            </div>
          ))}

        </ScrollArea>

      </DialogContent>
    </Dialog >
  )
}

export default MembersModal