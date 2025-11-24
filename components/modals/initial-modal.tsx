"use client"
import { useEffect, useState } from "react"
import { useModal } from "@/hooks/use-modal-store"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ModalHeader } from "./_modal-header"

const InitialModal = () => {
  const [isMounted, setIsMounted] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)
  const { type, isOpen, onOpen, onClose } = useModal()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const checkServerMembership = async () => {
      if (!isMounted || hasChecked) return

      try {
        const response = await fetch("/api/servers")
        if (response.ok) {
          const data = await response.json()
          // Auto-open modal if user has no servers (first-time visitor)
          if (!data.hasServers) {
            onOpen("initialModal")
          }
        }
      } catch (error) {
        console.error("[INITIAL_MODAL]", error)
      } finally {
        setHasChecked(true)
      }
    }

    checkServerMembership()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted])

  if (!isMounted || !hasChecked) {
    return null
  }

  // Only render if this modal is open via the modal store
  if (type !== "initialModal" || !isOpen) {
    return null
  }

  const handleCreate = () => {
    onClose()
    onOpen("createServer")
  }

  const handleJoin = () => {
    onClose()
    onOpen("joinServer")
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        // Re-check if user has servers before allowing close
        fetch("/api/servers")
          .then((res) => res.json())
          .then((data) => {
            if (data.hasServers) {
              onClose()
            }
          })
          .catch(() => {
            // On error, allow closing
            onClose()
          })
      }
    }}>
      <DialogContent>
        <ModalHeader title="Welcome to Guildhall" description="Create a server or join with an invite." />
        <div className="px-6 pb-6 grid gap-3">
          <Button variant="primary" onClick={handleCreate}>
            Create a Server
          </Button>
          <Button variant="secondary" onClick={handleJoin}>
            Join with Invite
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default InitialModal