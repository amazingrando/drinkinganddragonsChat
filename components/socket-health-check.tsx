"use client"

import { useEffect, useState } from "react"
import { UseSocket } from "@/components/providers/socket-provider"

export const SocketHealthCheck = () => {
  const { socket, isConnected } = UseSocket()
  const [lastPing, setLastPing] = useState<Date | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<string>("disconnected")

  useEffect(() => {
    if (!socket) return

    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("ping")
        setLastPing(new Date())
      }
    }, 30000) // Ping every 30 seconds

    socket.on("pong", () => {
      setConnectionStatus("healthy")
    })

    socket.on("connect", () => {
      setConnectionStatus("connected")
    })

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected")
    })

    return () => {
      clearInterval(pingInterval)
    }
  }, [socket])

  // Only show in development or when there are connection issues
  if (process.env.NODE_ENV === "production" && isConnected) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs">
      <div>Socket: {connectionStatus}</div>
      <div>Connected: {isConnected ? "Yes" : "No"}</div>
      {lastPing && <div>Last ping: {lastPing.toLocaleTimeString()}</div>}
    </div>
  )
}
