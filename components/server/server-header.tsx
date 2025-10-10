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
        <button className="w-full text-md font-semibold px-3 h-12 border-neutral-200 dark:border-neutral-800 border-b-2 flex items-center hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition">
          {server.name}
          <ChevronDownIcon className="w-5 h-5 ml-auto" />
        </button>

      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 text-xs font-medium text-black dark:text-neutral-400 space-y-[2px]">
        {isModerator && (
          <DropdownMenuItem className="text-indigo-600 dark:text-indigo-400 px-3 py-2 text-sm cursor-pointer" onClick={() => onOpen("invite", { server })}>
            Invite People
            <UserPlus className="w-4 h-4 ml-auto" />
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer">
            Server Settings
            <Settings className="w-4 h-4 ml-auto" />
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer">
            Manage Members
            <Users className="w-4 h-4 ml-auto" />
          </DropdownMenuItem>
        )}
        {isModerator && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer">
            Create Channel
            <Plus className="w-4 h-4 ml-auto" />
          </DropdownMenuItem>
        )}
        {isModerator && (
          <DropdownMenuSeparator />
        )}
        {isAdmin && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer text-rose-500 hover:text-rose-600 dark:hover:text-rose-400">
            Delete Server
            <Trash className="w-4 h-4 ml-auto" />
          </DropdownMenuItem>
        )}
        {!isAdmin && (
          <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer text-rose-500 hover:text-rose-600 dark:hover:text-rose-400">
            Leave Server
            <LogOut className="w-4 h-4 ml-auto" />
          </DropdownMenuItem>
        )}

      </DropdownMenuContent>
    </DropdownMenu>
  )
}