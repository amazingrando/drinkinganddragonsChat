"use client"

import { UseRealtime } from "@/components/providers/realtime-provider";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ChatMessage } from "@/types";

type ChatSocketProps = {
  addKey: string
  updateKey: string
  queryKey: string
}

type ChatPagesData = {
  pages?: Array<{ items: ChatMessage[]; nextCursor?: string | null }>
  pageParams?: unknown[]
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

export const useChatRealtime = ({
  addKey,
  updateKey,
  queryKey
}: ChatSocketProps) => {
  const { subscribe, unsubscribe } = UseRealtime();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!subscribe || !unsubscribe) {
      return;
    }

    // Subscribe to add messages
    const addChannel = subscribe(addKey, addKey, (payload: RealtimeBroadcastPayload<unknown>) => {
      const message = payload.payload as ChatMessage;
      const normalizedMessage: ChatMessage = {
        ...message,
        status: undefined,
      };

      queryClient.setQueryData<ChatPagesData | undefined>([queryKey], (oldData) => {
        const basePages = Array.isArray(oldData?.pages) ? oldData!.pages : [];

        let replaced = false;
        const nextPages = basePages.map((page) => {
          const items = page.items.map((item) => {
            if (message.optimisticId && item.optimisticId === message.optimisticId) {
              replaced = true;
              return {
                ...normalizedMessage,
              };
            }
            return item;
          });

          return {
            ...page,
            items,
          };
        });

        if (replaced) {
          return {
            ...oldData,
            pages: nextPages,
          };
        }

        const messageExists = nextPages.some((page) =>
          page.items.some((item) => item.id === normalizedMessage.id),
        );

        if (messageExists) {
          return {
            ...oldData,
            pages: nextPages,
          };
        }

        if (!nextPages.length) {
          return {
            pages: [
              {
                items: [normalizedMessage],
                nextCursor: null,
              },
            ],
          };
        }

        const [firstPage, ...rest] = nextPages;

        return {
          ...oldData,
          pages: [
            {
              ...firstPage,
              items: [normalizedMessage, ...firstPage.items],
            },
            ...rest,
          ],
        };
      });
    });

    // Subscribe to update messages
    const updateChannel = subscribe(updateKey, updateKey, (payload: RealtimeBroadcastPayload<unknown>) => {
      const message = payload.payload as ChatMessage;
      const normalizedMessage: ChatMessage = {
        ...message,
        status: undefined,
      };

      queryClient.setQueryData<ChatPagesData | undefined>([queryKey], (oldData) => {
        if (!oldData || !Array.isArray(oldData.pages) || !oldData.pages.length) {
          return oldData;
        }

        const nextPages = oldData.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => {
            if (item.id === normalizedMessage.id) {
              return normalizedMessage;
            }

            if (message.optimisticId && item.optimisticId === message.optimisticId) {
              return normalizedMessage;
            }

            return item;
          }),
        }));

        return {
          ...oldData,
          pages: nextPages,
        };
      })
    });

    return () => {
      if (addChannel) unsubscribe(addChannel);
      if (updateChannel) unsubscribe(updateChannel);
    }
  }, [queryClient, addKey, queryKey, updateKey, unsubscribe, subscribe]);
}
