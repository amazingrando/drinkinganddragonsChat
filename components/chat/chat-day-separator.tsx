import { cn } from "@/lib/utils"

interface ChatDaySeparatorProps {
  label: string
  className?: string
}

const ChatDaySeparator = ({ label, className }: ChatDaySeparatorProps) => {
  return (
    <div className={cn("flex items-center gap-3 py-4 text-muted-foreground", className)}>
      <span className="flex-1 h-px bg-border" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      <span className="flex-1 h-px bg-border" aria-hidden="true" />
    </div>
  )
}

export default ChatDaySeparator

