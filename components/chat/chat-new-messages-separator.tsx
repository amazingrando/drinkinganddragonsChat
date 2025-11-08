"use client"

import React from "react"

type ChatNewMessagesSeparatorProps = React.HTMLAttributes<HTMLDivElement>

export const ChatNewMessagesSeparator = React.forwardRef<HTMLDivElement, ChatNewMessagesSeparatorProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative flex items-center gap-2 my-4 ${className ?? ""}`}
        {...props}
      >
        <span className="flex-1 h-px bg-mana-500/40 dark:bg-mana-400/30" />
        <span className="text-xs font-semibold uppercase tracking-wide text-mana-600 dark:text-mana-300">
          New messages
        </span>
        <span className="flex-1 h-px bg-mana-500/40 dark:bg-mana-400/30" />
      </div>
    )
  },
)

ChatNewMessagesSeparator.displayName = "ChatNewMessagesSeparator"

