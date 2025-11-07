"use client"

import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from "react"
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
  const activeChannelsRef = useRef<Set<RealtimeChannel>>(new Set())
  const hasSessionRef = useRef(false)

  useEffect(() => {
    // Track connection status
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      hasSessionRef.current = !!session
      setIsConnected(hasSessionRef.current || activeChannelsRef.current.size > 0)
    })

    // Initial connection check
    supabase.auth.getSession().then(({ data: { session } }) => {
      hasSessionRef.current = !!session
      setIsConnected(hasSessionRef.current || activeChannelsRef.current.size > 0)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const ensureChannel = useCallback((channelName: string) => {
    let channel = channelsRef.current.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName)
      channelsRef.current.set(channelName, channel)
    }
    return channel
  }, [supabase])

  const ensureSubscribed = useCallback((channel: RealtimeChannel) => {
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
        if (process.env.NODE_ENV !== "production") {
          console.debug(`Realtime channel ${channel.topic} status:`, status)
        }
        if (status === "SUBSCRIBED") {
          subscriptionPromisesRef.current.delete(channel)
          activeChannelsRef.current.add(channel)
          setIsConnected(hasSessionRef.current || activeChannelsRef.current.size > 0)
          resolve()
          return
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscriptionPromisesRef.current.delete(channel)
          activeChannelsRef.current.delete(channel)
          setIsConnected(hasSessionRef.current || activeChannelsRef.current.size > 0)
          reject(new Error(`Failed to subscribe to channel ${channel.topic}: ${status}`))
          return
        }

        if (status === "CLOSED") {
          subscriptionPromisesRef.current.delete(channel)
          activeChannelsRef.current.delete(channel)
          const stillTracked = channelsRef.current.get(channel.topic) === channel
          if (stillTracked) {
            setIsConnected(hasSessionRef.current || activeChannelsRef.current.size > 0)
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
  }, [])

  const subscribe = useCallback((channelName: string, event: string, callback: (payload: RealtimeBroadcastPayload<unknown>) => void) => {
    const channel = ensureChannel(channelName)
    channel.on("broadcast", { event }, callback)
    ensureSubscribed(channel).catch((error) => {
      console.error(error)
    })
    return channel
  }, [ensureChannel, ensureSubscribed])

  const unsubscribe = useCallback((channel: RealtimeChannel) => {
    activeChannelsRef.current.delete(channel)
    supabase.removeChannel(channel)
    // Remove from channels map
    for (const [key, value] of channelsRef.current.entries()) {
      if (value === channel) {
        channelsRef.current.delete(key)
        subscriptionPromisesRef.current.delete(value)
        break
      }
    }
    setIsConnected(hasSessionRef.current || activeChannelsRef.current.size > 0)
  }, [supabase])

  const broadcast = useCallback(async (channelName: string, event: string, payload: Record<string, unknown>) => {
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
  }, [ensureChannel, ensureSubscribed])

  // Cleanup all channels on unmount
  useEffect(() => {
    const channelsMap = channelsRef.current
    return () => {
      channelsMap.forEach((channel) => {
        supabase.removeChannel(channel)
        subscriptionPromisesRef.current.delete(channel)
        activeChannelsRef.current.delete(channel)
      })
      channelsMap.clear()
      setIsConnected(hasSessionRef.current || activeChannelsRef.current.size > 0)
    }
  }, [supabase])

  const contextValue = useMemo(() => ({
    subscribe,
    unsubscribe,
    broadcast,
    isConnected,
  }), [subscribe, unsubscribe, broadcast, isConnected])

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  )
}
