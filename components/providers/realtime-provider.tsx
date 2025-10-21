"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

type RealtimeContextType = {
  subscribe: (channelName: string, event: string, callback: (payload: any) => void) => RealtimeChannel
  unsubscribe: (channel: RealtimeChannel) => void
  broadcast: (channelName: string, event: string, payload: any) => Promise<void>
  isConnected: boolean
}

const RealtimeContext = createContext<RealtimeContextType>({
  subscribe: () => null as any,
  unsubscribe: () => { },
  broadcast: async () => { },
  isConnected: false,
})

export const UseRealtime = () => {
  return useContext(RealtimeContext)
}

export const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [supabase] = useState(() => createClient())
  const [channels, setChannels] = useState<Map<string, RealtimeChannel>>(new Map())

  useEffect(() => {
    // Track connection status
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsConnected(!!session)
    })

    // Initial connection check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsConnected(!!session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const subscribe = (channelName: string, event: string, callback: (payload: any) => void) => {
    // Clean up existing channel if it exists
    const existingChannel = channels.get(channelName)
    if (existingChannel) {
      supabase.removeChannel(existingChannel)
    }

    const channel = supabase.channel(channelName)

    channel.on('broadcast', { event }, callback)

    channel.subscribe((status) => {
      console.log(`Realtime channel ${channelName} status:`, status)
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
      }
    })

    // Store channel for cleanup
    setChannels(prev => new Map(prev).set(channelName, channel))

    return channel
  }

  const unsubscribe = (channel: RealtimeChannel) => {
    supabase.removeChannel(channel)
    // Remove from channels map
    setChannels(prev => {
      const newMap = new Map(prev)
      for (const [key, value] of newMap.entries()) {
        if (value === channel) {
          newMap.delete(key)
          break
        }
      }
      return newMap
    })
  }

  const broadcast = async (channelName: string, event: string, payload: any) => {
    const channel = supabase.channel(channelName)
    await channel.subscribe()
    await channel.send({
      type: 'broadcast',
      event,
      payload
    })
    await supabase.removeChannel(channel)
  }

  // Cleanup all channels on unmount
  useEffect(() => {
    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel)
      })
    }
  }, [channels, supabase])

  return (
    <RealtimeContext.Provider value={{
      subscribe,
      unsubscribe,
      broadcast,
      isConnected
    }}>
      {children}
    </RealtimeContext.Provider>
  )
}
