"use client"

import { UseRealtime } from "@/components/providers/realtime-provider"
import { Badge } from "@/components/ui/badge"

export const SocketIndicator = () => {
  const { isConnected } = UseRealtime()

  if (!isConnected) {
    return (
      <Badge variant="outline" className="bg-yellow-600 text-white border-none">
        Realtime Not Connected
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-emerald-600 text-white border-none">
      Realtime Connected
    </Badge>
  )
}