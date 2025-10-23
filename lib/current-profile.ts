import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"

export const currentProfile = async () => {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null;
  }

  const profile = await db.profile.findUnique({
    where: { userId: user.id }
  })

  return profile
}