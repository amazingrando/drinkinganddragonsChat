import { createClient } from '@supabase/supabase-js'

export async function broadcastMessage(
  channelName: string,
  event: string,
  payload: Record<string, unknown>
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  
  const channel = supabase.channel(channelName)
  try {
    await channel.httpSend(event, payload ?? {})
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error(`Failed to deliver broadcast for channel ${channelName}`)
  }
}
