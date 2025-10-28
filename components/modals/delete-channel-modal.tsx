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
import qs from "query-string"
import { ModalHeader } from "./_modal-header"

const DeleteChannelModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()
  const isModalOpen = isOpen && type === "deleteChannel"
  const { channel, server } = data || {}

  const [isLoading, setIsLoading] = useState(false)

  const onClick = async () => {
    try {
      setIsLoading(true)
      const url = qs.stringifyUrl({
        url: `/api/channels/${channel?.id}`,
        query: {
          serverId: server?.id,
        },
      })

      await axios.delete(url)

      onClose()
      router.refresh()
      router.push(`/servers/${server?.id}`)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <ModalHeader title="Delete Channel" description={`You are currently deleting <strong>{channel?.name}</strong>. Are you sure you want to delete it?`} />
        <DialogFooter className="px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" disabled={isLoading} onClick={onClose}>Cancel</Button>
            <Button variant="destructive" disabled={isLoading} onClick={onClick}>Leave Server</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  )
}

export default DeleteChannelModal