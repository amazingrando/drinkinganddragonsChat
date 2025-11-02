"use client"

import { UseRealtime } from "@/components/providers/realtime-provider";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Member, Message, Profile } from "@prisma/client";

type ChatSocketProps = {
  addKey: string
  updateKey: string
  queryKey: string
}

type MessageWithMemberWithProfile = Message & {
  member: Member & {
    profile: Profile
  }
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
      const message = payload.payload as MessageWithMemberWithProfile;
      queryClient.setQueryData([queryKey], (oldData: { pages?: Array<{ items: MessageWithMemberWithProfile[] }> } | undefined) => {
        if (!oldData || !Array.isArray(oldData.pages) || oldData.pages.length === 0) {
          return {
            pages: [{
              items: [message],
            }]
          }
        }

        // Check if message already exists in any page to prevent duplicates
        const messageExists = oldData.pages.some(page => 
          page.items.some(item => item.id === message.id)
        );

        if (messageExists) {
          return oldData;
        }

        const newData = [...oldData.pages];

        newData[0] = {
          ...newData[0],
          items: [
            message,
            ...newData[0].items,
          ]
        };

        return {
          ...oldData,
          pages: newData,
        };
      });
    });

    // Subscribe to update messages
    const updateChannel = subscribe(updateKey, updateKey, (payload: RealtimeBroadcastPayload<unknown>) => {
      const message = payload.payload as MessageWithMemberWithProfile;
      queryClient.setQueryData([queryKey], (oldData: { pages?: Array<{ items: MessageWithMemberWithProfile[] }> } | undefined) => {
        if (
          !oldData ||
          !Array.isArray(oldData.pages) ||
          oldData.pages.length === 0
        ) {
          return oldData;
        }

        const newData = oldData.pages.map((page) => {
          return {
            ...page,
            items: page.items.map((item: MessageWithMemberWithProfile) => {
              if (item.id === message.id) {
                return message;
              }
              return item;
            })
          }
        });

        return {
          ...oldData,
          pages: newData,
        }
      })
    });

    return () => {
      if (addChannel) unsubscribe(addChannel);
      if (updateChannel) unsubscribe(updateChannel);
    }
  }, [queryClient, addKey, queryKey, updateKey, unsubscribe, subscribe]);
}
