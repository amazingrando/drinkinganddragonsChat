"use client"

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { useState, useEffect, useCallback } from "react"
import { useModal } from "@/hooks/use-modal-store"
import { Button } from "@/components/ui/button"
import axios from "axios"
import qs from "query-string"
import { ModalHeader } from "./_modal-header"
import { Loader2, PinOff, ArrowRight } from "lucide-react"
import UserAvatar from "@/components/user-avatar"
import { format } from "date-fns"
import { MessageWithPoll } from "@/types"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { ActionTooltip } from "@/components/action-tooltip"

const DATE_FORMAT = "d MMM yyyy, HH:mm"

const PinnedMessagesModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const isModalOpen = isOpen && type === "pinnedMessages"
  const { channelId, serverId } = data || {}
  const params = useParams()

  const [pinnedMessages, setPinnedMessages] = useState<MessageWithPoll[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [unpinningId, setUnpinningId] = useState<string | null>(null)

  const fetchPinnedMessages = useCallback(async () => {
    if (!channelId || !serverId) return

    try {
      setIsLoading(true)
      const url = qs.stringifyUrl({
        url: `/api/channels/${channelId}/pinned`,
        query: { serverId },
      })
      const response = await axios.get(url)
      setPinnedMessages(response.data.items || [])
    } catch (error) {
      console.error("Failed to fetch pinned messages:", error)
    } finally {
      setIsLoading(false)
    }
  }, [channelId, serverId])

  useEffect(() => {
    if (isModalOpen && channelId && serverId) {
      fetchPinnedMessages()
    }
  }, [isModalOpen, channelId, serverId, fetchPinnedMessages])

  const handleUnpin = async (messageId: string) => {
    try {
      setUnpinningId(messageId)
      const url = qs.stringifyUrl({
        url: `/api/messages/${messageId}/pin`,
        query: {
          channelId,
          serverId,
        },
      })
      await axios.patch(url)
      // Remove from local state
      setPinnedMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    } catch (error) {
      console.error("Failed to unpin message:", error)
    } finally {
      setUnpinningId(null)
    }
  }

  const handleJumpToMessage = (messageId: string) => {
    onClose()
    // Small delay to ensure modal is closed
    setTimeout(() => {
      const element = document.querySelector(`[data-chat-item-id="${messageId}"]`)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" })
        // Highlight the message briefly
        element.classList.add("ring-2", "ring-mana-500")
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-mana-500")
        }, 2000)
      }
    }, 100)
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <ModalHeader title="Pinned Messages" description="Important messages pinned to this channel." />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PinOff className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pinned messages yet</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Pin important messages by hovering over them and clicking the pin icon
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pinnedMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "p-4 rounded-lg border border-border bg-lavender-50 dark:bg-background/50",
                    "hover:bg-lavender-100 dark:hover:bg-background/70 transition"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <UserAvatar
                          src={message.member.profile.email}
                          imageUrl={message.member.profile.imageUrl}
                          className="w-6 h-6"
                        />
                        <span className="font-semibold text-sm text-foreground">
                          {message.member.profile.name || message.member.profile.email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.createdAt), DATE_FORMAT)}
                        </span>
                      </div>
                      <div className="text-sm text-foreground">
                        {message.deleted ? (
                          <span className="line-through text-muted-foreground">{message.content}</span>
                        ) : (
                          <MarkdownRenderer
                            content={message.content}
                            serverId={params?.serverId as string | undefined}
                            currentUserId={message.member.profile.id}
                            currentUserName={message.member.profile.name}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ActionTooltip label="Jump to message">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleJumpToMessage(message.id)}
                        >
                          <ArrowRight className="h-4 w-4 text-icon-muted-foreground hover:text-white transition" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Unpin">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUnpin(message.id)}
                          disabled={unpinningId === message.id}
                        >
                          {unpinningId === message.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PinOff className="h-4 w-4 text-icon-muted-foreground hover:text-white  transition" />
                          )}
                        </Button>
                      </ActionTooltip>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PinnedMessagesModal

