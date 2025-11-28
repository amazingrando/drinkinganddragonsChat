"use client"

import { cn } from "@/lib/utils"
import { ChannelCategory, MemberRole, Server } from "@prisma/client"
import { ChevronDown, Edit, Trash, GripVertical, Plus } from "lucide-react"
import { useState } from "react"
import { ActionTooltip } from "../action-tooltip"
import { useModal, ModalType } from "@/hooks/use-modal-store"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface ServerCategoryProps {
  category: ChannelCategory & { channels: Array<{ id: string; name: string; type: string }> }
  server: Server
  role?: MemberRole
  children?: React.ReactNode
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export const ServerCategory = ({
  category,
  server,
  role,
  children,
  isCollapsed = false,
  onToggleCollapse,
}: ServerCategoryProps) => {
  const { onOpen } = useModal()
  const [collapsed, setCollapsed] = useState(isCollapsed)

  const canManage = role !== MemberRole.MEMBER

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
    disabled: !canManage,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleToggle = () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)
    if (onToggleCollapse) {
      onToggleCollapse()
    }
  }

  const onAction = (e: React.MouseEvent, action: ModalType) => {
    e.stopPropagation()
    onOpen(action, { category, server })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("mb-2", isDragging && "opacity-50")}
    >
      <div
        className={cn(
          "flex items-center justify-between py-2 px-1 rounded-md group cursor-pointer hover:bg-muted/60 transition",
          !collapsed && "mb-1"
        )}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-x-1 flex-1 min-w-0">
          {canManage && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/60 mr-1 flex-shrink-0 hidden group-hover:block" />
            </div>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-150", collapsed ? "-rotate-90" : "rotate-0")} />
          <p className="text-xs uppercase font-semibold text-muted-foreground truncate">
            {category.name}
          </p>
        </div>
        {canManage && (
          <div className="ml-auto flex items-center gap-x-2 flex-shrink-0">
            <ActionTooltip label="Create Channel">
              <Plus
                onClick={(e) => onAction(e, "createChannel")}
                className="hidden group-hover:block w-4 h-4 text-icon-muted-foreground hover:text-foreground dark:hover:text-white transition"
              />
            </ActionTooltip>
            <ActionTooltip label="Edit Category">
              <Edit
                onClick={(e) => onAction(e, "editCategory")}
                className="hidden group-hover:block w-4 h-4 text-icon-muted-foreground hover:text-foreground dark:hover:text-white transition"
              />
            </ActionTooltip>
            <ActionTooltip label="Delete Category">
              <Trash
                onClick={(e) => onAction(e, "deleteCategory")}
                className="hidden group-hover:block w-4 h-4 text-icon-muted-foreground hover:text-foreground dark:hover:text-white transition"
              />
            </ActionTooltip>
          </div>
        )}
      </div>
      {!collapsed && children && <div className="pl-2">{children}</div>}
    </div>
  )
}

