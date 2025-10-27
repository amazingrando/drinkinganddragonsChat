'use client'

import { ServerWithMembersWithProfiles } from "@/types"
import { MemberRole } from "@prisma/client"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, LogOut, Plus, Settings, Trash, UserPlus, Users } from "lucide-react"
import { useModal } from "@/hooks/use-modal-store"

interface ServerHeaderProps {
  server: ServerWithMembersWithProfiles
  role?: MemberRole
}

export const ServerHeader = ({ server, role }: ServerHeaderProps) => {
  const { onOpen } = useModal()
  const isAdmin = role === MemberRole.ADMIN
  const isModerator = isAdmin || role === MemberRole.MODERATOR

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none" asChild>
        <button className="w-full text-md font-semibold px-3 h-12 border-border border-b-1 flex items-center hover:bg-muted/60 transition">
          {server.name}
          <ChevronDownIcon className="w-5 h-5 ml-auto text-mana-500" />
        </button>

      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 text-xs font-medium text-foreground space-y-[2px]">
        {isModerator && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer group" onClick={() => onOpen("invite", { server })}>
            Invite People
            <UserPlus className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-300 " />
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer group"
            onClick={() => onOpen("editServer", { server })}
          >
            Server Settings
            <Settings className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-300 " />
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer group"
            onClick={() => onOpen("members", { server })}
          >
            Manage Members
            <Users className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-300" />
          </DropdownMenuItem>
        )}
        {isModerator && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer group" onClick={() => onOpen("createChannel", { server })}>
            Create Channel
            <Plus className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-300" />
          </DropdownMenuItem>
        )}
        {isModerator && (
          <DropdownMenuSeparator />
        )}
        {isAdmin && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer text-rose-500 hover:bg-rose-600 group" onClick={() => onOpen("deleteServer", { server })}>
            Delete Server
            <Trash className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-300" />
          </DropdownMenuItem>
        )}
        {!isAdmin && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 group" onClick={() => onOpen("leaveServer", { server })}>
            Leave Server
            <LogOut className="w-4 h-4 ml-auto text-mana-500 group-hover:text-white" />
          </DropdownMenuItem>
        )}

      </DropdownMenuContent>
    </DropdownMenu>
  )
}