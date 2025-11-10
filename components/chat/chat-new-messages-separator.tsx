"use client"

import React from "react"
import { Button } from "@/components/ui/button"

type ChatNewMessagesSeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  onMarkAsRead?: () => void
}

export const ChatNewMessagesSeparator = React.forwardRef<HTMLDivElement, ChatNewMessagesSeparatorProps>(
  ({ className, onMarkAsRead, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative flex items-center gap-2 my-4 ${className ?? ""}`}
        {...props}
      >
        <span className="flex-1 h-px bg-jelly-600/50 dark:bg-jelly-500/50" />
        <span className="text-xs font-semibold uppercase tracking-wide text-jelly-600 dark:text-white">
          New messages
        </span>
        {onMarkAsRead && (
          <Button
            onClick={onMarkAsRead}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs font-semibold uppercase tracking-wide"
          >
            Mark as read
          </Button>
        )}
        <span className="flex-1 h-px bg-jelly-600/50 dark:bg-jelly-500/50" />
      </div>
    )
  },
)

ChatNewMessagesSeparator.displayName = "ChatNewMessagesSeparator"


