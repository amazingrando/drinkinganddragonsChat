"use client"

import { UseRealtime } from "@/components/providers/realtime-provider"
import { Badge } from "@/components/ui/badge"

export const SocketIndicator = () => {
  const { isConnected } = UseRealtime()

  if (!isConnected) {
    return (
      <div className="flex justify-center items-center h-screen" aria-description="Realtime Not Connected">
        <div className="relative inline-flex">
          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
          <div className="w-4 h-4 bg-yellow-500 rounded-full absolute top-0 left-0 motion-safe:animate-ping"></div>
          <div className="w-4 h-4 bg-yellow-500 rounded-full absolute top-0 left-0 motion-safe:animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center h-screen" aria-description="Realtime Connected">
      <div className="relative inline-flex">
        <div className="w-4 h-4 bg-green-500 rounded-full"></div>
        <div className="w-4 h-4 bg-green-500 rounded-full absolute top-0 left-0 motion-safe:animate-socket-ping"></div>
        <div className="w-4 h-4 bg-green-500 rounded-full absolute top-0 left-0 motion-safe:animate-socket-pulse"></div>
      </div>
    </div>
  )
}