"use client"

import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useModal } from "@/hooks/use-modal-store"
import { Button } from "@/components/ui/button"
import axios from "axios"
import qs from "query-string"
import { ModalHeader } from "./_modal-header"

const DeleteMessageModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const isModalOpen = isOpen && type === "deleteMessage"
  const { apiUrl, query } = data || {}

  const [isLoading, setIsLoading] = useState(false)

  const onClick = async () => {
    try {
      setIsLoading(true)
      const url = qs.stringifyUrl({
        url: apiUrl || "",
        query: query as qs.StringifiableRecord | undefined,
      })

      await axios.delete(url)

      onClose()
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <ModalHeader title="Delete Message" description="Are you sure you want to delete this message? This action cannot be undone." />
        <DialogFooter className="bg-gray-100 px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" disabled={isLoading} onClick={onClose}>Cancel</Button>
            <Button variant="destructive" disabled={isLoading} onClick={onClick}>Delete Message</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  )
}

export default DeleteMessageModal