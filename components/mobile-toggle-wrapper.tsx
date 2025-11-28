import ServerSidebar from "./server/server-sidebar"
import NavigationSidebar from "./navigation/navigation-sidebar"
import { MobileToggle } from "./mobile-toggle"

interface MobileToggleWrapperProps {
  serverId: string
}

export const MobileToggleWrapper = ({ serverId }: MobileToggleWrapperProps) => {
  return (
    <MobileToggle
      navigationSidebar={<NavigationSidebar />}
      serverSidebar={<ServerSidebar serverId={serverId} />}
    />
  )
}

