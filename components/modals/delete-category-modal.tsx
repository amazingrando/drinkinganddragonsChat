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
import { useRouter } from "next/navigation"
import { ModalHeader } from "./_modal-header"

const DeleteCategoryModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()
  const isModalOpen = isOpen && type === "deleteCategory"
  const { category, server } = data || {}

  const [isLoading, setIsLoading] = useState(false)

  const onClick = async () => {
    try {
      setIsLoading(true)
      const url = `/api/servers/${server?.id}/categories/${category?.id}`

      await axios.delete(url)

      onClose()
      router.refresh()
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <ModalHeader
          title="Delete Category"
          description={`You are currently deleting <strong>${category?.name}</strong>. Channels in this category will be moved to ungrouped. Are you sure you want to delete it?`}
        />
        <DialogFooter className="px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" disabled={isLoading} onClick={onClose}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isLoading} onClick={onClick}>
              Delete Category
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteCategoryModal

