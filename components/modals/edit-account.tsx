"use client"

import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import { useModal } from "@/hooks/use-modal-store"
import { Button } from "@/components/ui/button"
import { ModalHeader } from "./_modal-header"

const EditAccountModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const isModalOpen = isOpen && type === "account"
  const { profile } = data || {}

  if (!profile) {
    return null
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <ModalHeader title="Edit Account" description="Edit your account." />
        <DialogFooter className="px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={onClose}>Save Changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  )
}

export default EditAccountModal