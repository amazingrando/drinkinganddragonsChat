"use client"

import { createContext, useContext, useEffect, useState, useRef } from "react"
import { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

type RealtimeBroadcastPayload<T> = {
  type: "broadcast";
  event: string;
  meta?: {
    replayed?: boolean;
    id: string;
  };
  payload: T;
};

type RealtimeContextType = {
  subscribe: (channelName: string, event: string, callback: (payload: RealtimeBroadcastPayload<unknown>) => void) => RealtimeChannel
  unsubscribe: (channel: RealtimeChannel) => void
  broadcast: (channelName: string, event: string, payload: Record<string, unknown>) => Promise<void>
  isConnected: boolean
}

const RealtimeContext = createContext<RealtimeContextType>({
  subscribe: () => null as unknown as RealtimeChannel,
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
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map())
  const subscriptionPromisesRef = useRef<WeakMap<RealtimeChannel, Promise<void>>>(new WeakMap())

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

  const ensureChannel = (channelName: string) => {
    let channel = channelsRef.current.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName)
      channelsRef.current.set(channelName, channel)
    }
    return channel
  }

  const ensureSubscribed = (channel: RealtimeChannel) => {
    if (channel.state === "SUBSCRIBED") {
      return Promise.resolve()
    }

    const promises = subscriptionPromisesRef.current
    const existingPromise = promises.get(channel)
    if (existingPromise) {
      return existingPromise
    }

    const promise = new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        console.log(`Realtime channel ${channel.topic} status:`, status)
        if (status === "SUBSCRIBED") {
          subscriptionPromisesRef.current.delete(channel)
          setIsConnected(true)
          resolve()
          return
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscriptionPromisesRef.current.delete(channel)
          setIsConnected(false)
          reject(new Error(`Failed to subscribe to channel ${channel.topic}: ${status}`))
          return
        }

        if (status === "CLOSED") {
          subscriptionPromisesRef.current.delete(channel)
          const stillTracked = channelsRef.current.get(channel.topic) === channel
          setIsConnected(false)
          if (stillTracked) {
            reject(new Error(`Channel ${channel.topic} closed unexpectedly`))
          } else {
            resolve()
          }
        }
      })
    }).catch((error) => {
      subscriptionPromisesRef.current.delete(channel)
      throw error
    })

    promises.set(channel, promise)
    return promise
  }

  const subscribe = (channelName: string, event: string, callback: (payload: RealtimeBroadcastPayload<unknown>) => void) => {
    const channel = ensureChannel(channelName)
    channel.on("broadcast", { event }, callback)
    ensureSubscribed(channel).catch((error) => {
      console.error(error)
    })
    return channel
  }

  const unsubscribe = (channel: RealtimeChannel) => {
    supabase.removeChannel(channel)
    // Remove from channels map
    for (const [key, value] of channelsRef.current.entries()) {
      if (value === channel) {
        channelsRef.current.delete(key)
        subscriptionPromisesRef.current.delete(value)
        break
      }
    }
  }

  const broadcast = async (channelName: string, event: string, payload: Record<string, unknown>) => {
    const channel = ensureChannel(channelName)
    await ensureSubscribed(channel)
    const { status, error } = await channel.send({
      type: "broadcast",
      event,
      payload,
    })

    if (status !== "ok" || error) {
      throw error ?? new Error(`Realtime send failed for channel ${channelName}`)
    }
  }

  // Cleanup all channels on unmount
  useEffect(() => {
    const channelsMap = channelsRef.current
    return () => {
      channelsMap.forEach((channel) => {
        supabase.removeChannel(channel)
        subscriptionPromisesRef.current.delete(channel)
      })
      channelsMap.clear()
    }
  }, [supabase])

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
