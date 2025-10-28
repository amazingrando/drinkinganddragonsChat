"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useModal } from "@/hooks/use-modal-store"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, Copy, RefreshCcw } from "lucide-react"
import { useOrigin } from "@/hooks/use-origin"
import axios from "axios"
import { ModalHeader } from "./_modal-header"

const InviteModal = () => {
  const { isOpen, type, onOpen, onClose, data } = useModal()
  const origin = useOrigin()

  const isModalOpen = isOpen && type === "invite"
  const { server } = data || {}

  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const inviteURL = `${origin}/invite/${server?.inviteCode}`

  const onCopy = () => {
    navigator.clipboard.writeText(inviteURL)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 1000)
  }

  const onNew = async () => {
    try {
      setIsLoading(true)
      const response = await axios.patch(`/api/servers/${server?.id}/invite-code`)

      onOpen("invite", { server: response.data })

    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <ModalHeader title="Invite Friends" description="Invite friends to your server." />
        <div className="space-y-2 px-6">
          <Label className="text-xs font-bold uppercase">Server Invite Link</Label>
          <div className="flex items-center gap-x-2">
            <Input
              className=""
              placeholder="Enter invite link"
              value={inviteURL}
              disabled={isLoading}
            />
            <Button variant="primary" onClick={onCopy} disabled={isLoading}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button variant="link" size="sm" className="text-xs text-muted-foreground bg-muted/70" onClick={onNew} disabled={isLoading}>
            Generate a new link
            <RefreshCcw className="w-4 h-4 ml-2" />
          </Button>
        </div>

      </DialogContent>
    </Dialog >
  )
}

export default InviteModal