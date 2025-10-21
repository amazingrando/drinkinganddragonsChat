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

export const useChatRealtime = ({
  addKey,
  updateKey,
  queryKey
}: ChatSocketProps) => {
  const { subscribe, unsubscribe } = UseRealtime();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to add messages
    const addChannel = subscribe(addKey, addKey, (message: MessageWithMemberWithProfile) => {
      queryClient.setQueryData([queryKey], (oldData: { pages?: Array<{ items: MessageWithMemberWithProfile[] }> } | undefined) => {
        if (!oldData || !Array.isArray(oldData.pages) || oldData.pages.length === 0) {
          return {
            pages: [{
              items: [message],
            }]
          }
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
    const updateChannel = subscribe(updateKey, updateKey, (message: MessageWithMemberWithProfile) => {
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
      unsubscribe(addChannel);
      unsubscribe(updateChannel);
    }
  }, [queryClient, addKey, queryKey, subscribe, unsubscribe, updateKey]);
}
