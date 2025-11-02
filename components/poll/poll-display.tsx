"use client"

import { useEffect, useState } from "react"
import { PollWithOptionsAndVotes } from "@/types"
import { CheckSquare, Square, Clock, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import UserAvatar from "@/components/user-avatar"
import { UseRealtime } from "@/components/providers/realtime-provider"

interface PollDisplayProps {
  poll: PollWithOptionsAndVotes
  currentMemberId: string
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

export const PollDisplay = ({ poll, currentMemberId, channelId }: PollDisplayProps) => {
  const [localPoll, setLocalPoll] = useState<PollWithOptionsAndVotes>(poll)
  const [isClosed, setIsClosed] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const { subscribe, unsubscribe } = UseRealtime()

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

  // Get votes for current member
  const memberVotes = localPoll.options
    .filter(option => option.votes.some(vote => vote.memberId === currentMemberId))
    .map(option => option.id)

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

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base">{localPoll.title}</h3>
          {isClosed && <Lock className="h-4 w-4 text-muted-foreground" />}
          {!isClosed && localPoll.endsAt && <Clock className="h-4 w-4 text-muted-foreground" />}
        </div>
        {!isClosed && localPoll.endsAt && <span className="text-xs text-muted-foreground">{timeRemaining}</span>}
      </div>

      <div className="space-y-2">
        {localPoll.options.map((option) => {
          const voteCount = option.votes.length
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0
          const isVoted = memberVotes.includes(option.id)
          const voters = option.votes.map(vote => vote.member)

          return (
            <div key={option.id} className="space-y-2">
              <button
                onClick={() => handleVote(option.id)}
                disabled={isClosed}
                className={cn(
                  "w-full text-left p-3 rounded-md border transition-colors",
                  "hover:bg-accent",
                  isVoted && "bg-primary/10 border-primary",
                  isClosed && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {localPoll.allowMultipleChoices ? (
                    <CheckSquare className={cn("h-4 w-4", isVoted && "text-primary")} />
                  ) : (
                    <Square className={cn("h-4 w-4", isVoted && "text-primary")} />
                  )}
                  <span className="font-medium">{option.text}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {voteCount} {voteCount === 1 ? "vote" : "votes"}
                  </span>
                </div>

                {/* Progress bar */}
                {totalVotes > 0 && (
                  <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        isVoted ? "bg-primary" : "bg-muted-foreground/50"
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}

                {/* Show voters */}
                {voters.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {voters.slice(0, 5).map((voter, idx) => (
                      <div key={idx} className="w-5 h-5 rounded-full overflow-hidden">
                        <UserAvatar src={voter.profile.email} />
                      </div>
                    ))}
                    {voters.length > 5 && (
                      <span className="text-xs text-muted-foreground">
                        +{voters.length - 5} more
                      </span>
                    )}
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

