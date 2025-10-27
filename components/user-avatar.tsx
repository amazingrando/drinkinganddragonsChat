import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  src?: string
  className?: string
}

const UserAvatar = ({ src, className }: UserAvatarProps) => {
  return (
    <Avatar className={cn("h-7 w-7 md:h-10 md:w-10 bg-muted", className)}>
      <AvatarImage src={src} />
      <AvatarFallback className="bg-muted">
        {src?.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

export default UserAvatar