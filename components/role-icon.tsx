import { MemberRole } from "@prisma/client"
import { ShieldAlert, ShieldCheck, Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface RoleIconProps {
  role: MemberRole
  className?: string
}

const roleIconMap = {
  [MemberRole.ADMIN]: ShieldAlert,
  [MemberRole.MODERATOR]: ShieldCheck,
  [MemberRole.MEMBER]: Users,
}

const roleColorMap = {
  [MemberRole.ADMIN]: "text-jelly-600",
  [MemberRole.MODERATOR]: "text-mana-600",
  [MemberRole.MEMBER]: "text-lavender-700 dark:text-mana-400/60",
}

export const RoleIcon = ({ role, className }: RoleIconProps) => {
  const IconComponent = roleIconMap[role]
  const defaultColor = roleColorMap[role]

  return <IconComponent className={cn("w-4 h-4 mr-2", defaultColor, className)} />
}

