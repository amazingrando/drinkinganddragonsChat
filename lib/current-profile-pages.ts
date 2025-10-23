import { createServerClient } from '@supabase/ssr'
import { db } from "@/lib/db"
import { NextApiRequest } from "next"

export const currentProfilePages = async (req: NextApiRequest) => {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({
            name,
            value: value || '',
          }))
        },
        setAll(cookiesToSet) {
          // For API routes, we can't set cookies directly
          // This is handled by the client-side auth flow
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null;
  }

  const profile = await db.profile.findUnique({
    where: { userId: user.id }
  })

  return profile
}