"use client"

import { useEffect, useState } from "react"
import { LiveKitRoom, VideoConference } from "@livekit/components-react"
import "@livekit/components-styles"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { Loader2 } from "lucide-react"

interface MediaRoomProps {
  chatId: string
  video: boolean
  audio: boolean
}

export const MediaRoom = ({ chatId, video, audio }: MediaRoomProps) => {
  const { user } = useSupabaseUser()
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return;

    const name = user.user_metadata?.full_name || user.email || "Anonymous";

    (async () => {
      try {
        const response = await fetch(`/api/livekit?room=${chatId}&username=${encodeURIComponent(name)}`)
        const data = await response.json()
        setToken(data.token)
      } catch (error) {
        console.error("[MEDIA_ROOM_ERROR]", error)
      }
    })()
  }, [user, chatId])

  if (token === "") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        <p className="text-sm text-zinc-500">Loading media room...</p>
      </div>
    )
  }

  return (
    <LiveKitRoom
      data-lk-theme="default"
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      token={token!}
      connect={true}
      audio={audio}
      video={video}
    >
      <VideoConference />
    </LiveKitRoom>
  )
}