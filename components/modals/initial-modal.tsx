"use client"
import { useEffect, useState } from "react"
import { useModal } from "@/hooks/use-modal-store"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ModalHeader } from "./_modal-header"

const InitialModal = () => {
  const [isMounted, setIsMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const { onOpen } = useModal()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  const handleCreate = () => {
    setIsOpen(false)
    onOpen("createServer")
  }

  const handleJoin = () => {
    setIsOpen(false)
    onOpen("joinServer")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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