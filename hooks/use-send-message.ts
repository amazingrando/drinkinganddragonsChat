"use client"

import { useCallback } from "react"
import axios from "axios"
import qs from "query-string"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Member, Profile } from "@prisma/client"

import { ChatMessage } from "@/types"
import {
  createOptimisticMessage,
  upsertPendingMessage,
  updateMessageStatus,
  SendMessageVariables,
  InfiniteChatData,
  OptimisticMessageParams,
} from "./use-send-message-helpers"

type UseSendMessageParams = {
  apiUrl: string
  query: Record<string, string | undefined>
  queryKey: string
  currentMember: Member & { profile: Profile }
  type: "channel" | "conversation"
}

export const useSendMessage = (params: UseSendMessageParams) => {
  const { apiUrl, queryKey, query, currentMember, type } = params
  const queryClient = useQueryClient()
  const queryKeyArray = [queryKey]
  const helperParams: OptimisticMessageParams = {
    currentMember,
    query,
    type,
  }

  const mutation = useMutation<ChatMessage, unknown, SendMessageVariables>({
    mutationKey: [...queryKeyArray, "send"],
    mutationFn: async ({ content, tempId }) => {
      const url = qs.stringifyUrl(
        {
          url: apiUrl,
          query,
        },
        { skipNull: true },
      )

      const response = await axios.post<ChatMessage>(url, { content, optimisticId: tempId })
      return response.data
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeyArray })

      queryClient.setQueryData<InfiniteChatData | undefined>(
        queryKeyArray,
        (oldData) => upsertPendingMessage(oldData, helperParams, variables),
      )

      return { tempId: variables.tempId }
    },
    onError: (_error, variables) => {
      queryClient.setQueryData<InfiniteChatData | undefined>(
        queryKeyArray,
        (oldData) =>
          updateMessageStatus(oldData, variables.tempId, (message) => ({
            ...message,
            status: "failed",
          })),
      )
    },
    onSuccess: (serverMessage, variables) => {
      queryClient.setQueryData<InfiniteChatData | undefined>(
        queryKeyArray,
        (oldData) =>
          updateMessageStatus(oldData, variables.tempId, () => ({
            ...serverMessage,
            status: undefined,
            optimisticId: undefined,
          })),
      )
    },
  })

  const sendMessage = useCallback(
    async (content: string, options?: { tempId?: string; isRetry?: boolean }) => {
      const tempId = options?.tempId ?? crypto.randomUUID()
      await mutation.mutateAsync({
        content,
        tempId,
        isRetry: options?.isRetry,
      })
    },
    [mutation],
  )

  return {
    sendMessage,
    isSending: mutation.isPending,
    pendingTempId: mutation.variables?.tempId,
  }
}

export const chatMessageMutationUtils = {
  createOptimisticMessage,
  upsertPendingMessage,
  updateMessageStatus,
}


