"use client"

import { UseRealtime } from "@/components/providers/realtime-provider"

export const SocketIndicator = () => {
  const { isConnected } = UseRealtime()

  return (
    <div
      className="flex justify-center items-center h-screen"
      aria-description={isConnected ? "Realtime Connected" : "Realtime Not Connected"}
    >
      <div className="relative inline-flex">
        <div
          className={`w-4 h-4 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500"}`}
        ></div>
        <div
          className={`w-4 h-4 rounded-full absolute top-0 left-0 motion-safe:animate-socket-ping ${isConnected ? "bg-green-500" : "bg-yellow-500"}`}
        ></div>
        <div
          className={`w-4 h-4 rounded-full absolute top-0 left-0 motion-safe:animate-socket-pulse ${isConnected ? "bg-green-500" : "bg-yellow-500"}`}
        ></div>
      </div>
    </div>
  )
}