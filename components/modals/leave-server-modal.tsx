"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useModal } from "@/hooks/use-modal-store"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { useRouter } from "next/navigation"
import { ModalHeader } from "./_modal-header"

const LeaveServerModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()
  const isModalOpen = isOpen && type === "leaveServer"
  const { server } = data || {}

  const [isLoading, setIsLoading] = useState(false)

  const onClick = async () => {
    try {
      setIsLoading(true)
      await axios.patch(`/api/servers/${server?.id}/leave`)
      onClose()
      router.refresh()
      router.push("/")
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <ModalHeader title="Leave Server" description={`You are currently leaving <strong>${server?.name}</strong>.`} />
        <DialogFooter className="bg-gray-100 px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" disabled={isLoading} onClick={onClose}>Cancel</Button>
            <Button variant="destructive" disabled={isLoading} onClick={onClick}>Leave Server</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  )
}

export default LeaveServerModal