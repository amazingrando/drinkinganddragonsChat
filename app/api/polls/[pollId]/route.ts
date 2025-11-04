import { NextRequest, NextResponse } from "next/server"
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { broadcastMessage } from "@/lib/supabase/server-broadcast"
import { MemberRole, Prisma } from "@prisma/client"
import { PollWithOptionsAndVotes } from "@/types"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  try {
    const { pollId } = await params
    console.log("[POLL_EDIT_PATCH] Starting edit for poll:", pollId)
    const profile = await currentProfile()
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get("channelId")
    const body = await request.json()
    console.log("[POLL_EDIT_PATCH] Request body:", JSON.stringify(body))
    const {
      title,
      options,
      optionOrder,
      allowMultipleChoices,
      allowAddOptions,
      durationHours,
      durationDays,
      endDate,
    }: {
      title?: string
      options?: string[]
      optionOrder?: string[]
      allowMultipleChoices?: boolean
      allowAddOptions?: boolean
      durationHours?: number
      durationDays?: number
      endDate?: string | null
    } = body

    if (!profile) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Fetch poll
    const poll = await db.poll.findUnique({
      where: { id: pollId },
      include: {
        creator: {
          include: {
            profile: true,
          },
        },
      },
    })

    if (!poll) {
      return NextResponse.json({ message: "Poll not found" }, { status: 404 })
    }

    // Find the member through server membership (similar to close route)
    const server = await db.server.findFirst({
      where: {
        members: { some: { profileID: profile.id } },
      },
      include: { members: true },
    })

    if (!server) {
      return NextResponse.json({ message: "Server not found" }, { status: 404 })
    }

    const member = server.members.find(m => m.profileID === profile.id)
    
    if (!member) {
      return NextResponse.json({ message: "Member not found" }, { status: 404 })
    }

    // Check permissions: creator, admin, or moderator can edit
    const isCreator = poll.creatorId === member.id
    const isAdmin = member.role === MemberRole.ADMIN
    const isModerator = member.role === MemberRole.MODERATOR

    if (!isCreator && !isAdmin && !isModerator) {
      return NextResponse.json({ message: "Only poll owners, admins, and moderators can edit polls" }, { status: 403 })
    }

    // Check if poll is closed
    const isClosed = poll.closedAt !== null || (poll.endsAt && new Date(poll.endsAt) < new Date())
    if (isClosed) {
      return NextResponse.json({ message: "Cannot edit a closed poll" }, { status: 400 })
    }

    // Build update data with explicit type instead of `any`
    interface PollUpdateData {
      title?: string
      allowMultipleChoices?: boolean
      allowAddOptions?: boolean
      endsAt?: Date | null
      optionOrder?: Prisma.InputJsonValue
      // Add more fields if needed
    }
    const updateData: PollUpdateData = {}

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ message: "Title must be a non-empty string" }, { status: 400 })
      }
      updateData.title = title.trim()
    }

    if (allowMultipleChoices !== undefined) {
      if (typeof allowMultipleChoices !== "boolean") {
        return NextResponse.json({ message: "allowMultipleChoices must be a boolean" }, { status: 400 })
      }
      updateData.allowMultipleChoices = allowMultipleChoices
    }

    if (allowAddOptions !== undefined) {
      if (typeof allowAddOptions !== "boolean") {
        return NextResponse.json({ message: "allowAddOptions must be a boolean" }, { status: 400 })
      }
      updateData.allowAddOptions = allowAddOptions
    }

    // Handle end date updates
    if (endDate !== undefined || durationHours !== undefined || durationDays !== undefined) {
      let endsAt: Date | null | undefined = undefined
      
      // Explicitly clear end date if null is sent (user wants to remove end date)
      if (endDate === null) {
        endsAt = null
      } else if (endDate && typeof endDate === "string") {
        endsAt = new Date(endDate)
        if (isNaN(endsAt.getTime())) {
          return NextResponse.json({ message: "Invalid end date format" }, { status: 400 })
        }
      } else if (durationHours !== undefined && durationHours !== null) {
        if (typeof durationHours !== "number" || durationHours <= 0) {
          return NextResponse.json({ message: "Duration hours must be a positive number" }, { status: 400 })
        }
        endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)
      } else if (durationDays !== undefined && durationDays !== null) {
        if (typeof durationDays !== "number" || durationDays <= 0) {
          return NextResponse.json({ message: "Duration days must be a positive number" }, { status: 400 })
        }
        endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
      }
      
      // Only set endsAt if we have a valid value or explicitly null
      if (endsAt !== undefined) {
        updateData.endsAt = endsAt
      }
    }

    // Handle optionOrder update
    if (optionOrder !== undefined) {
      if (!Array.isArray(optionOrder)) {
        return NextResponse.json({ message: "optionOrder must be an array" }, { status: 400 })
      }
      updateData.optionOrder = optionOrder
    }

    // Handle options update
    let validOptions: string[] = []
    if (options !== undefined) {
      console.log("[POLL_EDIT_PATCH] Updating options:", options)
      if (!Array.isArray(options) || options.length < 2) {
        return NextResponse.json({ message: "At least 2 options are required" }, { status: 400 })
      }
      
      // Filter out empty options
      validOptions = options.map(opt => opt.trim()).filter(opt => opt.length > 0)
      if (validOptions.length < 2) {
        return NextResponse.json({ message: "At least 2 non-empty options are required" }, { status: 400 })
      }
      
      try {
        // Fetch existing options to preserve votes, ordered by creation time
        const existingOptions = await db.pollOption.findMany({
          where: { pollId: pollId },
          include: {
            votes: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        })

        // Create maps for easier lookup
        const existingOptionsMapByText = new Map<string, typeof existingOptions[0]>()
        const existingOptionsArray = existingOptions // Keep array for position-based matching
        existingOptions.forEach(opt => {
          const normalizedText = opt.text.trim().toLowerCase()
          // Use normalized lowercase text as key
          if (!existingOptionsMapByText.has(normalizedText)) {
            existingOptionsMapByText.set(normalizedText, opt)
          }
        })

        // Process options in the order they appear in validOptions to preserve order
        const processedOptionIds: string[] = []
        const optionsToUpdate: { id: string; text: string; position: number }[] = []
        const optionsToCreate: { text: string; position: number }[] = []
        const usedExistingIndices = new Set<number>() // Track which existing options we've matched

        validOptions.forEach((newText, index) => {
          const normalizedText = newText.trim()
          const normalizedTextLower = normalizedText.toLowerCase()
          
          // First, try to match by exact text (case-insensitive)
          const existingByText = existingOptionsMapByText.get(normalizedTextLower)
          
          if (existingByText && !processedOptionIds.includes(existingByText.id)) {
            // Found by text match - preserve it (preserves votes)
            processedOptionIds.push(existingByText.id)
            const existingIndex = existingOptionsArray.findIndex(opt => opt.id === existingByText.id)
            if (existingIndex !== -1) {
              usedExistingIndices.add(existingIndex)
            }
            // Update text if there are any differences (case, whitespace)
            if (existingByText.text.trim() !== normalizedText) {
              optionsToUpdate.push({ id: existingByText.id, text: normalizedText, position: index })
            }
          } else {
            // No text match - try to match by position if option count is the same
            // This handles cases where user edits option text but keeps it in the same position
            if (existingOptionsArray.length === validOptions.length && 
                index < existingOptionsArray.length) {
              const existingByPosition = existingOptionsArray[index]
              // Only use position match if this option hasn't been matched yet
              if (!processedOptionIds.includes(existingByPosition.id) && 
                  !usedExistingIndices.has(index)) {
                // Match by position - update text but keep ID (preserves votes)
                processedOptionIds.push(existingByPosition.id)
                usedExistingIndices.add(index)
                optionsToUpdate.push({ id: existingByPosition.id, text: normalizedText, position: index })
              } else {
                // Position already matched, create new option
                optionsToCreate.push({ text: normalizedText, position: index })
              }
            } else {
              // Option count changed or no position match - create new option
              optionsToCreate.push({ text: normalizedText, position: index })
            }
          }
        })

        // Delete options that no longer exist
        const optionsToDelete = existingOptions
          .filter(opt => !processedOptionIds.includes(opt.id))
          .map(opt => opt.id)

        if (optionsToDelete.length > 0) {
          await db.pollOption.deleteMany({
            where: {
              id: { in: optionsToDelete },
            },
          })
          console.log("[POLL_EDIT_PATCH] Deleted", optionsToDelete.length, "options")
        }

        // Update options with text changes (whitespace differences)
        for (const { id, text } of optionsToUpdate) {
          await db.pollOption.update({
            where: { id },
            data: { text },
          })
        }
        if (optionsToUpdate.length > 0) {
          console.log("[POLL_EDIT_PATCH] Updated", optionsToUpdate.length, "options")
        }

        // Create new options in the correct order
        // We'll create them one by one to ensure they're created in the right position
        // (since createMany doesn't guarantee order, we'll use individual creates)
        const newOptionIds: string[] = []
        for (const { text } of optionsToCreate.sort((a, b) => a.position - b.position)) {
          const newOption = await db.pollOption.create({
            data: {
              text,
              pollId: pollId,
              createdBy: member.id,
            },
          })
          newOptionIds.push(newOption.id)
        }
        if (optionsToCreate.length > 0) {
          console.log("[POLL_EDIT_PATCH] Created", optionsToCreate.length, "new options")
        }

        // If optionOrder was provided, use it. Otherwise, build order from processedOptionIds + newOptionIds
        if (optionOrder !== undefined && Array.isArray(optionOrder)) {
          // Validate and use provided optionOrder
          const allOptionIds = new Set([...processedOptionIds, ...newOptionIds])
          const validOrder = optionOrder.filter(id => allOptionIds.has(id))
          if (validOrder.length === allOptionIds.size) {
            updateData.optionOrder = validOrder
          } else {
            // Build order: existing options in processedOrder, then new options
            updateData.optionOrder = [...processedOptionIds, ...newOptionIds]
          }
        } else if (options !== undefined) {
          // Build order from the current state: processed options followed by new ones
          updateData.optionOrder = [...processedOptionIds, ...newOptionIds]
        }

        console.log("[POLL_EDIT_PATCH] Options updated successfully - votes preserved, order maintained")
      } catch (error) {
        console.error("[POLL_EDIT_PATCH] Error updating options:", error)
        throw error
      }
    }

    // Update poll only if there's data to update
    console.log("[POLL_EDIT_PATCH] Update data:", JSON.stringify(updateData))
    let updatedPoll
    try {
      if (Object.keys(updateData).length > 0) {
        console.log("[POLL_EDIT_PATCH] Updating poll with data")
        updatedPoll = await db.poll.update({
          where: { id: pollId },
          data: updateData,
          include: {
            options: {
              include: {
                votes: {
                  include: {
                    member: {
                      include: {
                        profile: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
            creator: {
              include: {
                profile: true,
              },
            },
          },
        })
      } else {
        console.log("[POLL_EDIT_PATCH] No poll fields to update, fetching poll")
        // If no poll fields to update, just fetch the poll with updated options
        updatedPoll = await db.poll.findUnique({
          where: { id: pollId },
          include: {
            options: {
              include: {
                votes: {
                  include: {
                    member: {
                      include: {
                        profile: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
            creator: {
              include: {
                profile: true,
              },
            },
          },
        })
      }
      console.log("[POLL_EDIT_PATCH] Poll updated/fetched successfully")
      
              // Reorder options using optionOrder if provided, otherwise by validOptions order
        const pollWithOrder = updatedPoll as PollWithOptionsAndVotes
        if (pollWithOrder && pollWithOrder.options) {
          if (pollWithOrder.optionOrder && Array.isArray(pollWithOrder.optionOrder)) {
            // Sort by optionOrder from database
            const orderMap = new Map(pollWithOrder.optionOrder.map((id: string, index: number) => [id, index]))
            pollWithOrder.options.sort((a, b) => {
              const aIndex = orderMap.get(a.id) ?? 999
              const bIndex = orderMap.get(b.id) ?? 999
              return aIndex - bIndex
            })
            console.log("[POLL_EDIT_PATCH] Options reordered using optionOrder")
          } else if (options !== undefined) {
            // Fallback to text-based matching if optionOrder not available
            const optionsOrderMap = new Map<string, number>()
            validOptions.forEach((text, index) => {
              optionsOrderMap.set(text.trim().toLowerCase(), index)
            })
            
            pollWithOrder.options.sort((a, b) => {
              const aIndex = optionsOrderMap.get(a.text.trim().toLowerCase()) ?? 999
              const bIndex = optionsOrderMap.get(b.text.trim().toLowerCase()) ?? 999
              return aIndex - bIndex
            })
            
            console.log("[POLL_EDIT_PATCH] Options reordered to match edit form")
          }
        }
    } catch (error) {
      console.error("[POLL_EDIT_PATCH] Error updating/fetching poll:", error)
      throw error
    }

    // Update message content if title changed
    if (title !== undefined && updatedPoll && poll.messageId) {
      try {
        await db.message.update({
          where: { id: poll.messageId },
          data: {
            content: `Poll: ${updatedPoll.title}`,
          },
        })
      } catch (error) {
        console.error("[POLL_EDIT_PATCH] Error updating message:", error)
        // Don't fail the whole request if message update fails
      }
    }

    // Verify updatedPoll exists before proceeding
    if (!updatedPoll) {
      return NextResponse.json({ message: "Failed to fetch updated poll" }, { status: 500 })
    }

    // Fetch complete message with poll for broadcast
    let messageWithPoll = null
    if (poll.messageId) {
      try {
        messageWithPoll = await db.message.findUnique({
          where: { id: poll.messageId },
          include: {
            poll: {
              include: {
                options: {
                  include: {
                    votes: {
                      include: {
                        member: {
                          include: {
                            profile: true,
                          },
                        },
                      },
                    },
                  },
                  orderBy: {
                    createdAt: 'asc',
                  },
                },
                creator: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            member: {
              include: {
                profile: true,
              },
            },
          },
        })
        
        // Reorder options in messageWithPoll using optionOrder if available
        const messagePoll = messageWithPoll?.poll as PollWithOptionsAndVotes | null
        if (messagePoll && messagePoll.options) {
          if (messagePoll.optionOrder && Array.isArray(messagePoll.optionOrder)) {
            const orderMap = new Map(messagePoll.optionOrder.map((id: string, index: number) => [id, index]))
            messagePoll.options.sort((a, b) => {
              const aIndex = orderMap.get(a.id) ?? 999
              const bIndex = orderMap.get(b.id) ?? 999
              return aIndex - bIndex
            })
          } else if (options !== undefined) {
            // Fallback to text-based matching
            const optionsOrderMap = new Map<string, number>()
            validOptions.forEach((text, index) => {
              optionsOrderMap.set(text.trim().toLowerCase(), index)
            })
            
            messagePoll.options.sort((a, b) => {
              const aIndex = optionsOrderMap.get(a.text.trim().toLowerCase()) ?? 999
              const bIndex = optionsOrderMap.get(b.text.trim().toLowerCase()) ?? 999
              return aIndex - bIndex
            })
          }
        }
      } catch (error) {
        console.error("[POLL_EDIT_PATCH] Error fetching message with poll:", error)
        // Continue without broadcast if message fetch fails
      }
    }

    // Broadcast the updated poll (non-blocking)
    if (channelId) {
      if (messageWithPoll) {
        const messageChannelKey = `chat:${channelId}:messages`
        try {
          await broadcastMessage(messageChannelKey, messageChannelKey, messageWithPoll)
        } catch (error) {
          console.log("[SUPABASE_BROADCAST_ERROR]", error)
        }
      }

      // Also broadcast to poll-specific channel
      const pollChannelKey = `poll:${pollId}:update`
      try {
        await broadcastMessage(pollChannelKey, pollChannelKey, updatedPoll)
      } catch (error) {
        console.log("[SUPABASE_BROADCAST_ERROR]", error)
      }
    }

    return NextResponse.json(updatedPoll, { status: 200 })
  } catch (error: unknown) {
    console.error("[POLL_EDIT_PATCH] ========== ERROR START ==========")
    console.error("[POLL_EDIT_PATCH] Error:", error)
    console.error("[POLL_EDIT_PATCH] Error type:", typeof error)
    if (error instanceof Error) {
      console.error("[POLL_EDIT_PATCH] Error name:", error.name)
      console.error("[POLL_EDIT_PATCH] Error message:", error.message)
      if (error.stack) {
        console.error("[POLL_EDIT_PATCH] Error stack:", error.stack)
      }
    }
    if (error && typeof error === 'object' && 'code' in error) {
      console.error("[POLL_EDIT_PATCH] Error code:", (error as { code: unknown }).code)
    }
    console.error("[POLL_EDIT_PATCH] ========== ERROR END ==========")
    
    // Safely extract error message
    let errorMessage = "Internal server error"
    try {
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage
      } else if (typeof error === "string") {
        errorMessage = error
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message)
      }
    } catch {
      // If we can't extract the message, use default
    }
    
    try {
      return NextResponse.json({ 
        message: errorMessage,
        error: errorMessage
      }, { status: 500 })
    } catch (jsonError) {
      // If we can't serialize the response, return a simple text response
      console.error("[POLL_EDIT_PATCH] Failed to serialize error response:", jsonError)
      return new NextResponse(errorMessage, { 
        status: 500,
        headers: { "Content-Type": "text/plain" }
      })
    }
  }
}

