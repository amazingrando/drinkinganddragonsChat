"use client"

import { Member, MemberRole, Profile } from "@prisma/client"
import UserAvatar from "@/components//user-avatar"
import { ActionTooltip } from "@/components//action-tooltip"
import { Copy, ShieldCheck, ShieldAlert, UserIcon, Users, Pencil, Trash } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import * as z from "zod"
import axios from "axios"
import qs from "query-string"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useModal } from "@/hooks/use-modal-store"

interface ChatItemProps {
  id: string,
  content: string,
  member: Member & { profile: Profile },
  timestamp: string,
  fileUrl: string | null,
  deleted: boolean,
  currentMember: Member,
  isUpdated: boolean,
  socketUrl: string,
  socketQuery: Record<string, string>,
}

const roleIconMap = {
  [MemberRole.ADMIN]: <ShieldAlert className="h-4 w-4 mr-2 text-indigo-500" />,
  [MemberRole.MODERATOR]: <ShieldCheck className="h-4 w-4 mr-2 text-purple-500" />,
  [MemberRole.MEMBER]: <Users className="h-4 w-4 mr-2 text-gray-500" />,
}

const formSchema = z.object({
  content: z.string().min(1),
})

export const ChatItem = ({ id, content, member, timestamp, fileUrl, deleted, currentMember, isUpdated, socketUrl, socketQuery }: ChatItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const { onOpen } = useModal();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc" || event.keyCode === 27) {
        setIsEditing(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    }
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: content,
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = qs.stringifyUrl({
        url: `${socketUrl}/${id}`,
        query: socketQuery,
      })
      await axios.patch(url, values);
      form.reset();
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    form.reset({
      content: content,
    });
  }, [content]);


  const isAdmin = member.role === MemberRole.ADMIN;
  const isModerator = member.role === MemberRole.MODERATOR;
  const isMember = member.role === MemberRole.MEMBER;
  const isOwner = currentMember.id === member.id;
  const canDeleteMessage = !deleted && (isAdmin || isModerator || isOwner);
  const canEditMessage = !deleted && isOwner && !fileUrl;
  const isImage = fileUrl;

  return (
    <div className="relative group flex items-center hover:bg-black/5 p-4 transition w-full">
      <div className="group flex gap-x-2 items-start w-full">
        <div className="cursor-pointer hover:drop-shadow-md transition">
          <UserAvatar src={member.profile.imageUrl} />
        </div>
        <div className="flex flex-col w-full">
          <div className="flex items-center gap-x-2">
            <div className="flex items-center gap-x-2">
              <p className="font-semibold text-sm hover:underline cursor-pointer">
                {member.profile.name}
              </p>
              <ActionTooltip label={member.role}>
                {roleIconMap[member.role]}
              </ActionTooltip>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {timestamp}
            </span>
          </div>

          {isImage && (
            <a className="relative aspect-video rounded-md overflow-hidden border flex items-center justify-center bg-secondary h-48 w-48" href={fileUrl} target="_blank" rel="noopener noreferrer">
              <Image src={fileUrl} alt="Content" fill className="object-cover" />
            </a>
          )}

          {!fileUrl && !isEditing && (
            <p className={cn(
              "text-sm text-zinc-600 dark:text-zinc-300",
              deleted && "line-through cursor-not-allowed"
            )}>
              {content}
              {isUpdated && !deleted && (
                <span className="text-[10px] mx-2 text-zinc-500 dark:text-zinc-400">
                  (edited)
                </span>
              )}
            </p>
          )}

          {!fileUrl && isEditing && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-x-2 pt-2 w-full">
                <FormField control={form.control} name="content" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="relative w-full">
                        <Input disabled={isLoading} {...field} className="p-2 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200" placeholder="Edit message" />
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
                <Button size="sm" type="submit" className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md" disabled={isLoading}>Save</Button>
                <Button size="sm" type="button" className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md" onClick={() => setIsEditing(false)} disabled={isLoading}>Cancel</Button>
              </form>
              <span className="text-[10px] text-zinc-400 mt-1">
                Press escape to cancel, enter to save.
              </span>
            </Form>
          )}
        </div>
      </div>

      {canDeleteMessage && (
        <div className="hidden group-hover:flex items-center gap-x-2 absolute p-1 -top-2 right-5 bg-white dark:bg-zinc-800 rounded-sm border">
          {canEditMessage && (
            <ActionTooltip label="Edit">
              <Pencil className="w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition cursor-pointer" onClick={() => setIsEditing(true)} />
            </ActionTooltip>
          )}
          <ActionTooltip label="Delete">
            <Trash className="w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition cursor-pointer" onClick={() => onOpen("deleteMessage", { apiUrl: `${socketUrl}/${id}`, query: socketQuery })} />
          </ActionTooltip>

        </div>
      )}
    </div>
  )
}

export default ChatItem