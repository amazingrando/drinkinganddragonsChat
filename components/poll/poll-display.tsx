"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { PollWithOptionsAndVotes } from "@/types"
import { CheckSquare, Square, Clock, Lock, Pencil, Circle, CircleCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import UserAvatar from "@/components/user-avatar"
import { UseRealtime } from "@/components/providers/realtime-provider"
import { useModal } from "@/hooks/use-modal-store"
import { ActionTooltip } from "@/components/action-tooltip"
import { MemberRole } from "@prisma/client"
import { toast } from "sonner"

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
  const [pendingVoteOptionIds, setPendingVoteOptionIds] = useState<Set<string>>(new Set())
  const pendingVoteOptionIdsRef = useRef<Set<string>>(new Set())
  const previousPollStatesRef = useRef<Map<string, PollWithOptionsAndVotes>>(new Map())
  const { subscribe, unsubscribe } = UseRealtime()
  const { onOpen } = useModal()

  // Check if current user can edit (owner, admin, or moderator)
  const isOwner = localPoll.creatorId === currentMemberId
  const isAdmin = currentMemberRole === MemberRole.ADMIN
  const isModerator = currentMemberRole === MemberRole.MODERATOR
  const canEdit = (isOwner || isAdmin || isModerator) && !isClosed

  // Subscribe to poll vote updates
  useEffect(() => {
    if (!subscribe || !unsubscribe) {
      return
    }

    const channelKey = `poll:${poll.id}:votes`
    const voteChannel = subscribe(channelKey, channelKey, (payload: RealtimeBroadcastPayload<unknown>) => {
      const updatedPoll = payload.payload as PollWithOptionsAndVotes
      
      // Merge broadcasted state with any remaining optimistic votes
      setLocalPoll((prevPoll) => {
        // Check which pending votes have been confirmed in the broadcast
        const confirmedPendingIds = new Set<string>()
        
        // For each pending option, check if the broadcast confirms our optimistic vote
        // Use ref to get current pending votes (not stale closure value)
        pendingVoteOptionIdsRef.current.forEach((pendingOptionId) => {
          const broadcastOption = updatedPoll.options.find(opt => opt.id === pendingOptionId)
          const prevOption = prevPoll.options.find(opt => opt.id === pendingOptionId)
          
          if (broadcastOption && prevOption) {
            const hasOurVoteInBroadcast = broadcastOption.votes.some(
              vote => vote.memberId === currentMemberId || vote.member?.id === currentMemberId
            )
            const hasOurOptimisticVote = prevOption.votes.some(
              vote => (vote.id?.startsWith('optimistic-') || vote.id === undefined) && vote.memberId === currentMemberId
            )
            const previousState = previousPollStatesRef.current.get(pendingOptionId)
            const hadVoteBefore = previousState?.options.find(opt => opt.id === pendingOptionId)?.votes.some(
              vote => vote.memberId === currentMemberId || vote.member?.id === currentMemberId
            ) ?? false
            
            // If we added a vote optimistically and it's now in the broadcast, it's confirmed
            if (hasOurOptimisticVote && hasOurVoteInBroadcast) {
              confirmedPendingIds.add(pendingOptionId)
            }
            // If we removed a vote optimistically (no optimistic vote but had one before) and it's confirmed removed
            else if (!hasOurOptimisticVote && !hasOurVoteInBroadcast && hadVoteBefore) {
              confirmedPendingIds.add(pendingOptionId)
            }
          }
        })
        
        // Remove confirmed pending votes from tracking
        if (confirmedPendingIds.size > 0) {
          setPendingVoteOptionIds((prev) => {
            const next = new Set(prev)
            confirmedPendingIds.forEach(id => {
              next.delete(id)
              previousPollStatesRef.current.delete(id)
            })
            pendingVoteOptionIdsRef.current = next
            return next
          })
        }
        
        // Merge broadcast state with any remaining optimistic votes
        const mergedOptions = updatedPoll.options.map((broadcastOption) => {
          // If this option still has a pending optimistic vote, merge it with broadcast
          // Use ref to get current pending votes (not stale closure value)
          if (pendingVoteOptionIdsRef.current.has(broadcastOption.id) && !confirmedPendingIds.has(broadcastOption.id)) {
            const prevOption = prevPoll.options.find(opt => opt.id === broadcastOption.id)
            
            if (prevOption) {
              // Find our optimistic vote
              const optimisticVotes = prevOption.votes.filter(
                vote => (vote.id?.startsWith('optimistic-') || vote.id === undefined) && vote.memberId === currentMemberId
              )
              
              if (optimisticVotes.length > 0) {
                // We optimistically added a vote - check if broadcast has it
                const hasOurVoteInBroadcast = broadcastOption.votes.some(
                  vote => vote.memberId === currentMemberId || vote.member?.id === currentMemberId
                )
                
                if (!hasOurVoteInBroadcast) {
                  // Our optimistic vote isn't in broadcast yet, keep it
                  return {
                    ...broadcastOption,
                    votes: [...broadcastOption.votes, ...optimisticVotes],
                  }
                }
              } else {
                // We optimistically removed a vote - check if broadcast still has it
                const hasOurVoteInBroadcast = broadcastOption.votes.some(
                  vote => vote.memberId === currentMemberId || vote.member?.id === currentMemberId
                )
                
                if (hasOurVoteInBroadcast) {
                  // Broadcast still has our vote but we removed it optimistically, remove it
                  return {
                    ...broadcastOption,
                    votes: broadcastOption.votes.filter(
                      vote => vote.memberId !== currentMemberId && vote.member?.id !== currentMemberId
                    ),
                  }
                }
              }
            }
          }
          
          // No pending optimistic vote for this option, use broadcast state as-is
          return broadcastOption
        })
        
        return {
          ...updatedPoll,
          options: mergedOptions,
        }
      })
    })

    return () => {
      if (voteChannel) {
        unsubscribe(voteChannel)
      }
    }
  }, [poll.id, subscribe, unsubscribe, currentMemberId])

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

  // Sort options by optionOrder if available, otherwise keep original order
  const sortedOptions = useMemo(() => {
    const poll = localPoll as PollWithOptionsAndVotes
    if (poll.optionOrder && Array.isArray(poll.optionOrder)) {
      const orderMap = new Map(poll.optionOrder.map((id: string, index: number) => [id, index]))
      return [...localPoll.options].sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? 999
        const bIndex = orderMap.get(b.id) ?? 999
        return aIndex - bIndex
      })
    }
    return localPoll.options
  }, [localPoll])

  // Calculate total votes
  const totalVotes = sortedOptions.reduce((sum, option) => sum + option.votes.length, 0)

  // Get votes for current member - recalculate when localPoll or currentMemberId changes
  const memberVotes = useMemo(() => {
    return sortedOptions
      .filter(option => option.votes.some(vote =>
        vote.memberId === currentMemberId || vote.member?.id === currentMemberId
      ))
      .map(option => option.id)
  }, [sortedOptions, currentMemberId])

  const handleVote = async (optionId: string) => {
    if (isClosed || pendingVoteOptionIds.has(optionId)) return

    const isCurrentlyVoted = memberVotes.includes(optionId)
    
    // Save current state for potential rollback (only if we don't already have a saved state)
    if (!previousPollStatesRef.current.has(optionId)) {
      previousPollStatesRef.current.set(optionId, JSON.parse(JSON.stringify(localPoll)))
    }
    
    // Add this option to pending set
    setPendingVoteOptionIds((prev) => {
      const next = new Set(prev).add(optionId)
      pendingVoteOptionIdsRef.current = next
      return next
    })

    // Optimistically update the poll state
    setLocalPoll((prevPoll) => {
      const updatedOptions = prevPoll.options.map((option) => {
        if (option.id === optionId) {
          if (isCurrentlyVoted) {
            // Remove vote optimistically
            return {
              ...option,
              votes: option.votes.filter(
                (vote) => vote.memberId !== currentMemberId && vote.member?.id !== currentMemberId
              ),
            }
          } else {
            // Add vote optimistically
            const optimisticVote = {
              id: `optimistic-${Date.now()}-${optionId}`,
              pollId: prevPoll.id,
              optionId: option.id,
              memberId: currentMemberId,
              createdAt: new Date(),
              member: null, // Will be populated by realtime update
            }
            return {
              ...option,
              votes: [...option.votes, optimisticVote],
            }
          }
        } else if (!prevPoll.allowMultipleChoices && !isCurrentlyVoted) {
          // If single choice poll and adding a vote, remove vote from other options
          return {
            ...option,
            votes: option.votes.filter(
              (vote) => vote.memberId !== currentMemberId && vote.member?.id !== currentMemberId
            ),
          }
        }
        return option
      })

      return {
        ...prevPoll,
        options: updatedOptions,
      }
    })

    try {
      const response = await fetch(`/api/polls/${poll.id}/vote?channelId=${channelId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          optionId,
          removeVote: isCurrentlyVoted,
        }),
      })

      if (!response.ok) {
        throw new Error(response.statusText || "Failed to vote")
      }

      // Remove from pending set - realtime broadcast will update the poll
      setPendingVoteOptionIds((prev) => {
        const next = new Set(prev)
        next.delete(optionId)
        pendingVoteOptionIdsRef.current = next
        return next
      })
      previousPollStatesRef.current.delete(optionId)
    } catch (error) {
      // Revert to previous state on error
      const previousState = previousPollStatesRef.current.get(optionId)
      if (previousState) {
        setLocalPoll(previousState)
        previousPollStatesRef.current.delete(optionId)
      }
      setPendingVoteOptionIds((prev) => {
        const next = new Set(prev)
        next.delete(optionId)
        pendingVoteOptionIdsRef.current = next
        return next
      })
      toast.error("Failed to vote. Please try again.")
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
        {sortedOptions.map((option) => {
          const voteCount = option.votes.length
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0
          // Check if current member has voted for this option - check both memberId and nested member.id
          const isVoted = option.votes.some(vote =>
            vote.memberId === currentMemberId || vote.member?.id === currentMemberId
          )
          const voters = option.votes
            .map(vote => vote.member)
            .filter((member): member is NonNullable<typeof member> => member !== null && member !== undefined)

          const isPending = pendingVoteOptionIds.has(option.id)

          return (
            <div key={option.id} className="space-y-2">
              <button
                onClick={() => handleVote(option.id)}
                disabled={isClosed || isPending}
                className={cn(
                  "w-full text-left p-3 rounded border transition-colors group/option-item",
                  "hover:border-white/40",
                  isVoted && " border-white/60",
                  (isClosed || isPending) && "cursor-not-allowed pointer-events-none",
                  isPending && "opacity-75"
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
                        <div className="flex items-center gap-0">
                          {voters.slice(0, 5).map((voter, idx) => (
                            <UserAvatar key={idx} src={voter.profile.email} imageUrl={voter.profile.imageUrl} size={20} className="-ml-1 border border-border rounded-full" />
                          ))}
                        </div>
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

