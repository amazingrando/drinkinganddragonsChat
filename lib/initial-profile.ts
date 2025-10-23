import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"

export const initialProfile = async () => {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return redirect('/sign-in')
  }

  const profile = await db.profile.findUnique({
    where: {
      userId: user.id,
    },
  })

  if (profile) {
    return profile
  }

  // Profile should be auto-created by database trigger, but fallback just in case
  const newProfile = await db.profile.create({
    data: {
      userId: user.id,
      name: user.user_metadata?.full_name || user.email || "",
      email: user.email || "",
      imageUrl: user.user_metadata?.avatar_url || "",
    },
  })

  return newProfile
}