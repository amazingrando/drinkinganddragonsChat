"use client"

import { useEffect, useState, useMemo } from "react"
import { PollWithOptionsAndVotes } from "@/types"
import { CheckSquare, Square, Clock, Lock, Pencil, Circle, CircleCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import UserAvatar from "@/components/user-avatar"
import { UseRealtime } from "@/components/providers/realtime-provider"
import { useModal } from "@/hooks/use-modal-store"
import { ActionTooltip } from "@/components/action-tooltip"
import { MemberRole } from "@prisma/client"

interface PollDisplayProps {
  poll: PollWithOptionsAndVotes
  currentMemberId: string
  currentMemberRole?: MemberRole
  channelId: string
}

type RealtimeBroadcastPayload<T> = {
  type: "broadcast";
  event: string;
  meta?: {
    replayed?: boolean;
    id: string;
  };
  payload: T;
};

export const PollDisplay = ({ poll, currentMemberId, currentMemberRole, channelId }: PollDisplayProps) => {
  const [localPoll, setLocalPoll] = useState<PollWithOptionsAndVotes>(poll)
  const [isClosed, setIsClosed] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const { subscribe, unsubscribe } = UseRealtime()
  const { onOpen } = useModal()

  // Check if current user can edit (owner or admin)
  const isOwner = localPoll.creatorId === currentMemberId
  const isAdmin = currentMemberRole === MemberRole.ADMIN
  const canEdit = (isOwner || isAdmin) && !isClosed

  // Subscribe to poll vote updates
  useEffect(() => {
    if (!subscribe || !unsubscribe) {
      return
    }

    const channelKey = `poll:${poll.id}:votes`
    const voteChannel = subscribe(channelKey, channelKey, (payload: RealtimeBroadcastPayload<unknown>) => {
      const updatedPoll = payload.payload as PollWithOptionsAndVotes
      setLocalPoll(updatedPoll)
    })

    return () => {
      if (voteChannel) {
        unsubscribe(voteChannel)
      }
    }
  }, [poll.id, subscribe, unsubscribe])

  // Subscribe to poll updates (for edits)
  useEffect(() => {
    if (!subscribe || !unsubscribe) {
      return
    }

    const updateChannelKey = `poll:${poll.id}:update`
    const updateChannel = subscribe(updateChannelKey, updateChannelKey, (payload: RealtimeBroadcastPayload<unknown>) => {
      const updatedPoll = payload.payload as PollWithOptionsAndVotes
      setLocalPoll(updatedPoll)
    })

    return () => {
      if (updateChannel) {
        unsubscribe(updateChannel)
      }
    }
  }, [poll.id, subscribe, unsubscribe])

  // Subscribe to poll close events
  useEffect(() => {
    if (!subscribe || !unsubscribe) {
      return
    }

    const closeChannelKey = `poll:${poll.id}:close`
    const closeChannel = subscribe(closeChannelKey, closeChannelKey, (payload: RealtimeBroadcastPayload<unknown>) => {
      const updatedPoll = payload.payload as PollWithOptionsAndVotes
      setLocalPoll(updatedPoll)
    })

    return () => {
      if (closeChannel) {
        unsubscribe(closeChannel)
      }
    }
  }, [poll.id, subscribe, unsubscribe])

  // Update local poll when prop changes
  useEffect(() => {
    setLocalPoll(poll)
  }, [poll])

  // Check if poll is closed and calculate time remaining
  useEffect(() => {
    const checkPollStatus = () => {
      const now = new Date()
      if (localPoll.closedAt) {
        setIsClosed(true)
      } else if (localPoll.endsAt) {
        const endDate = new Date(localPoll.endsAt)
        if (endDate < now) {
          setIsClosed(true)
        } else {
          const diff = endDate.getTime() - now.getTime()
          const days = Math.floor(diff / (1000 * 60 * 60 * 24))
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

          if (days > 0) {
            setTimeRemaining(`${days}d ${hours}h`)
          } else if (hours > 0) {
            setTimeRemaining(`${hours}h ${minutes}m`)
          } else {
            setTimeRemaining(`${minutes}m`)
          }
        }
      }
    }

    checkPollStatus()
    const interval = setInterval(checkPollStatus, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [localPoll])

  // Calculate total votes
  const totalVotes = localPoll.options.reduce((sum, option) => sum + option.votes.length, 0)

  // Get votes for current member - recalculate when localPoll or currentMemberId changes
  const memberVotes = useMemo(() => {
    return localPoll.options
      .filter(option => option.votes.some(vote =>
        vote.memberId === currentMemberId || vote.member?.id === currentMemberId
      ))
      .map(option => option.id)
  }, [localPoll, currentMemberId])

  const handleVote = async (optionId: string) => {
    if (isClosed) return

    const isCurrentlyVoted = memberVotes.includes(optionId)

    try {
      await fetch(`/api/polls/${localPoll.id}/vote?channelId=${channelId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          optionId,
          removeVote: isCurrentlyVoted,
        }),
      })
    } catch (error) {
      console.error("Error voting:", error)
    }
  }

  const handleEdit = () => {
    onOpen("editPoll", {
      poll: localPoll,
      query: {
        channelId,
      },
      currentMemberId,
      currentMemberRole,
    })
  }

  return (
    <div className="bg-muted/50 border border-border rounded p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base">{localPoll.title}</h3>
          {isClosed &&
            <ActionTooltip label="Poll Closed">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </ActionTooltip>
          }
          {!isClosed && localPoll.endsAt && <Clock className="h-4 w-4 text-muted-foreground" />}
          {!isClosed && localPoll.endsAt && <span className="text-xs text-muted-foreground">{timeRemaining}</span>}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <ActionTooltip label="Edit Poll">
              <button
                onClick={handleEdit}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            </ActionTooltip>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {localPoll.options.map((option) => {
          const voteCount = option.votes.length
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0
          // Check if current member has voted for this option - check both memberId and nested member.id
          const isVoted = option.votes.some(vote =>
            vote.memberId === currentMemberId || vote.member?.id === currentMemberId
          )
          const voters = option.votes.map(vote => vote.member)

          return (
            <div key={option.id} className="space-y-2">
              <button
                onClick={() => handleVote(option.id)}
                disabled={isClosed}
                className={cn(
                  "w-full text-left p-3 rounded border transition-colors group/option-item",
                  "hover:border-white/40",
                  isVoted && " border-white/60",
                  isClosed && "cursor-not-allowed pointer-events-none"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isVoted ? (
                    localPoll.allowMultipleChoices ? (
                      <CheckSquare className="h-4 w-4 text-white transition-colors group-hover/option-item:text-white" />
                    ) : (
                      <CircleCheck className="h-4 w-4 text-white transition-colors group-hover/option-item:text-white" />
                    )
                  ) : (
                    localPoll.allowMultipleChoices ? (
                      <Square className="h-4 w-4 text-muted-foreground transition-colors group-hover/option-item:text-white/80" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground transition-colors group-hover/option-item:text-white/80" />
                    )
                  )}

                  <span className={cn("font-medium", isVoted ? "text-white" : "text-muted-foreground transition-colors group-hover/option-item:text-white")}>{option.text}</span>

                  <div className="flex items-center justify-center gap-2 ml-auto">
                    {/* Show voters */}
                    {voters.length > 0 && (
                      <div className="flex items-center gap-1">
                        {voters.slice(0, 5).map((voter, idx) => (
                          <UserAvatar key={idx} src={voter.profile.email} size={50} className="size-5" />
                        ))}
                        {voters.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{voters.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {voteCount} {voteCount === 1 ? "vote" : "votes"}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                {totalVotes > 0 && (
                  <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all bg-muted-foreground/50",
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {totalVotes > 0 && (
        <div className="text-xs text-muted-foreground">
          {totalVotes} {totalVotes === 1 ? "vote" : "total votes"}
        </div>
      )}
    </div>
  )
}

