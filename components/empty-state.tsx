"use client"

import { Button } from "@/components/ui/button"
import { useModal } from "@/hooks/use-modal-store"

export const EmptyState = () => {
  const { onOpen } = useModal()

  const handleGetStarted = () => {
    onOpen("initialModal")
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-6 px-4 max-w-md">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Welcome to Guildhall</h1>
          <p className="text-muted-foreground text-lg">
            Get started by creating your own server or joining an existing one with an invite.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={handleGetStarted}>
          Get Started
        </Button>
      </div>
    </div>
  )
}

