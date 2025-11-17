"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { useProfileUpdateListener } from "@/hooks/use-profile-update-listener"

const ProfileUpdateListener = () => {
  useProfileUpdateListener()
  return null
}

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ProfileUpdateListener />
      {children}
    </QueryClientProvider >
  )
}