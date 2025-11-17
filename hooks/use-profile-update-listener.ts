"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Profile } from "@prisma/client"
import { ChatMessage } from "@/types"

type ChatPagesData = {
  pages?: Array<{ items: ChatMessage[]; nextCursor?: string | null }>
  pageParams?: unknown[]
}

/**
 * Hook that listens for profile updates and updates all chat message caches
 * to reflect the new profile data (name, imageUrl, etc.)
 */
export const useProfileUpdateListener = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent<Profile>) => {
      const updatedProfile = event.detail

      // Get all query keys that match chat queries
      const queryCache = queryClient.getQueryCache()
      const allQueries = queryCache.getAll()

      // Find all chat-related queries
      const chatQueries = allQueries.filter((query) => {
        const queryKey = query.queryKey[0]
        return typeof queryKey === 'string' && queryKey.startsWith('chat:')
      })

      // Update each chat query cache
      chatQueries.forEach((query) => {
        queryClient.setQueryData<ChatPagesData | undefined>(
          query.queryKey,
          (oldData) => {
            if (!oldData || !Array.isArray(oldData.pages) || !oldData.pages.length) {
              return oldData
            }

            // Update all messages that have this profile
            const nextPages = oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((item: ChatMessage) => {
                // Check if this message's member has the updated profile
                const member = item.member
                if (member?.profile?.id === updatedProfile.id) {
                  return {
                    ...item,
                    member: {
                      ...member,
                      profile: {
                        ...member.profile,
                        ...updatedProfile,
                      },
                    },
                  }
                }

                // Also check poll votes and creator if they exist
                if ('poll' in item && item.poll) {
                  const poll = item.poll
                  let updatedPoll = poll

                  // Update poll creator if it matches
                  if (poll.creator?.profile?.id === updatedProfile.id) {
                    updatedPoll = {
                      ...poll,
                      creator: {
                        ...poll.creator,
                        profile: {
                          ...poll.creator.profile,
                          ...updatedProfile,
                        },
                      },
                    }
                  }

                  // Update poll option votes if any match
                  if (poll.options) {
                    updatedPoll = {
                      ...updatedPoll,
                      options: poll.options.map((option) => {
                        if (!option.votes) return option
                        return {
                          ...option,
                          votes: option.votes.map((vote) => {
                            if (vote.member?.profile?.id === updatedProfile.id) {
                              return {
                                ...vote,
                                member: {
                                  ...vote.member,
                                  profile: {
                                    ...vote.member.profile,
                                    ...updatedProfile,
                                  },
                                },
                              }
                            }
                            return vote
                          }),
                        }
                      }),
                    }
                  }

                  if (updatedPoll !== poll) {
                    return {
                      ...item,
                      poll: updatedPoll,
                    }
                  }
                }

                return item
              }),
            }))

            return {
              ...oldData,
              pages: nextPages,
            }
          }
        )
      })
    }

    window.addEventListener('profile-updated', handleProfileUpdate as EventListener)

    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate as EventListener)
    }
  }, [queryClient])
}

