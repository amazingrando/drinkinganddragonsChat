'use client'

import * as React from "react"
import { ServerWithMembersWithProfiles } from "@/types"
import { MemberRole } from "@prisma/client"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, LogOut, Plus, Settings, ShieldAlert, ShieldCheck, Trash, UserPlus, Users } from "lucide-react"
import { useModal } from "@/hooks/use-modal-store"
import { SheetClose } from "@/components/ui/sheet"
import { CircleX } from "lucide-react"

interface ServerHeaderProps {
  server: ServerWithMembersWithProfiles
  role?: MemberRole
}

// Safe wrapper that only renders SheetClose when inside a Dialog context
// Uses a ref to check if we're inside a Sheet by looking for the data attribute
const SafeSheetClose = ({ children }: { children: React.ReactNode }) => {
  const [isInSheet, setIsInSheet] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    // Check if we're inside a Sheet by looking for the data-slot="sheet-content" attribute
    // This is set by SheetContent component
    if (!containerRef.current) return

    let element: HTMLElement | null = containerRef.current
    while (element) {
      if (element.getAttribute('data-slot') === 'sheet-content') {
        setIsInSheet(true)
        return
      }
      element = element.parentElement
    }
    setIsInSheet(false)
  }, [])

  if (!isInSheet) {
    return <div ref={containerRef} style={{ display: 'none' }} />
  }

  return (
    <div ref={containerRef}>
      <SheetClose asChild>{children}</SheetClose>
    </div>
  )
}

export const ServerHeader = ({ server, role }: ServerHeaderProps) => {
  const { onOpen } = useModal()
  const isAdmin = role === MemberRole.ADMIN
  const isModerator = isAdmin || role === MemberRole.MODERATOR

  return (
    <div className="flex items-center justify-between border-border border-b-1 pr-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="focus:outline-none" asChild>
          <button className="w-full text-md font-semibold px-3 h-12 flex items-center hover:bg-muted/60 transition">
            {isAdmin && <ShieldAlert className="w-4 h-4 mr-2 text-red-500" />}
            {role === MemberRole.MODERATOR && <ShieldCheck className="w-4 h-4 mr-2 text-mana-500" />}
            <span className="truncate">{server.name}</span>
            <ChevronDownIcon className="w-5 h-5 ml-auto text-mana-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 text-xs font-medium text-foreground space-y-[2px]">
          {isModerator && (
            <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer group" onClick={() => onOpen("invite", { server })}>
              Invite People
              <UserPlus className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-600 dark:group-hover:text-mana-300" />
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer group"
              onClick={() => onOpen("editServer", { server })}
            >
              Server Settings
              <Settings className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-600 dark:group-hover:text-mana-300" />
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer group"
              onClick={() => onOpen("members", { server })}
            >
              Manage Members
              <Users className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-600 dark:group-hover:text-mana-300" />
            </DropdownMenuItem>
          )}
          {isModerator && (
            <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer group" onClick={() => onOpen("createChannel", { server })}>
              Create Channel
              <Plus className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-600 dark:group-hover:text-mana-300" />
            </DropdownMenuItem>
          )}
          {isModerator && (
            <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer group" onClick={() => onOpen("createCategory", { server })}>
              Create Category
              <Plus className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-600 dark:group-hover:text-mana-300" />
            </DropdownMenuItem>
          )}
          {isModerator && (
            <DropdownMenuSeparator />
          )}
          {isAdmin && (
            <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer text-rose-500 hover:bg-rose-600 group" onClick={() => onOpen("deleteServer", { server })}>
              Delete Server
              <Trash className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-600 dark:group-hover:text-mana-300" />
            </DropdownMenuItem>
          )}
          {!isAdmin && (
            <DropdownMenuItem className="px-3 py-2 text-sm cursor-pointer text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 group" onClick={() => onOpen("leaveServer", { server })}>
              Leave Server
              <LogOut className="w-4 h-4 ml-auto text-mana-500 group-hover:text-mana-600 dark:group-hover:text-mana-300" />
            </DropdownMenuItem>
          )}

        </DropdownMenuContent>
      </DropdownMenu>
      <SafeSheetClose>
        <div><CircleX className="w-5 h-5 text-mana-400" /></div>
      </SafeSheetClose>
    </div>
  )
}