import { createClient } from '@supabase/supabase-js'

export async function broadcastMessage(
  channelName: string,
  event: string,
  payload: any
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  
  const channel = supabase.channel(channelName)
  await channel.subscribe()
  await channel.send({
    type: 'broadcast',
    event,
    payload
  })
  await supabase.removeChannel(channel)
}
