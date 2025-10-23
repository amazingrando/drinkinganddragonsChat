"use client"

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'

export default function Page() {
  const supabase = createClient()

  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#313338]">
      <div className="w-full max-w-md p-8">
        <Auth
          supabaseClient={supabase}
          view="sign_up"
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#6c47ff',
                  brandAccent: '#5a3fd4',
                },
              },
            },
          }}
          providers={['google', 'github']}
          redirectTo={`${window.location.origin}/`}
        />
      </div>
    </div>
  )
}