"use client"

import { Member, MemberRole, Profile } from "@prisma/client"
import UserAvatar from "@/components/user-avatar"
import { ActionTooltip } from "@/components//action-tooltip"
import { ShieldCheck, ShieldAlert, Users, Pencil, Trash, Loader2 } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import * as z from "zod"
import axios from "axios"
import qs from "query-string"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useModal } from "@/hooks/use-modal-store"
import { useRouter, useParams } from "next/navigation"
import { PollDisplay } from "@/components/poll/poll-display"
import { PollWithOptionsAndVotes } from "@/types"
import { RoleIcon } from "@/components/role-icon"

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
  poll?: PollWithOptionsAndVotes | null,
  status?: "pending" | "failed" | "sent",
  onRetry?: () => void,
  isRetrying?: boolean,
  isUnread?: boolean,
}

const formSchema = z.object({
  content: z.string().min(1),
})

export const ChatItem = ({
  id,
  content,
  member,
  timestamp,
  fileUrl,
  deleted,
  currentMember,
  isUpdated,
  socketUrl,
  socketQuery,
  poll,
  status,
  onRetry,
  isRetrying,
  isUnread = false,
}: ChatItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const { onOpen } = useModal();
  const router = useRouter();
  const params = useParams();

  const onMemberClick = () => {
    if (currentMember.id !== member.id) {
      return
    }

    router.push(`/servers/${params?.serverId}/conversations/${member.id}`)
  }

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
  }, [content, form]);

  const viewerIsAdmin = currentMember.role === MemberRole.ADMIN;
  const viewerIsModerator = currentMember.role === MemberRole.MODERATOR;
  const isOwner = currentMember.id === member.id;
  const canDeleteMessage = !deleted && (viewerIsAdmin || viewerIsModerator || isOwner);
  const canEditMessage = !deleted && isOwner && !fileUrl;
  const isImage = fileUrl;

  const isPending = status === "pending"
  const isFailed = status === "failed"

  return (
    <div
      data-chat-item-id={id}
      className={cn(
        "relative group flex items-center dark:hover:bg-background/70 hover:bg-lavender-200 p-4 transition w-full",
        isPending && "pointer-events-none",
        isFailed && "bg-destructive/10",
      )}
    >
      <div className="group flex gap-x-2 items-start w-full">
        <div className="cursor-pointer hover:drop-shadow-md transition" onClick={onMemberClick}>
          <UserAvatar src={member.profile.email} />
        </div>
        <div className="flex flex-col w-full">
          <div className="flex items-center gap-x-2">
            <div className="flex items-center gap-x-2">
              <p className="font-semibold text-sm hover:underline cursor-pointer text-muted-foreground" onClick={onMemberClick}>
                {member.profile.name || member.profile.email}
              </p>
              <ActionTooltip label={member.role}>
                <RoleIcon role={member.role} />
              </ActionTooltip>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {timestamp}
            </span>
            {isUnread && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-atomicorange-600">
                Unread
              </span>
            )}
          </div>

          {isImage && (
            <a className="relative aspect-video rounded-md overflow-hidden border flex items-center justify-center bg-secondary h-48 w-48" href={fileUrl} target="_blank" rel="noopener noreferrer">
              <Image src={fileUrl} alt="Content" fill className="object-cover" />
            </a>
          )}

          {poll && (
            <div className="mt-2">
              <PollDisplay
                poll={poll}
                currentMemberId={currentMember.id}
                currentMemberRole={currentMember.role}
                channelId={socketQuery.channelId || ""}
              />
            </div>
          )}

          {!fileUrl && !poll && !isEditing && (
            <p className={cn(
              "text-sm text-foreground font-medium",
              deleted && "line-through cursor-not-allowed"
            )}>
              {content}
              {isUpdated && !deleted && (
                <span className="text-[12px] mx-2 text-foreground/80">
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

          {isPending && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Sending...</span>
            </div>
          )}

          {isFailed && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-destructive">
              <span>Message failed to send.</span>
              {onRetry && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={onRetry}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Retrying...
                    </span>
                  ) : (
                    "Retry"
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {canDeleteMessage && (
        <div className={cn(
          "hidden group-hover:flex items-center gap-x-2 absolute p-1 -top-2 right-5 rounded-sm border border-border",
          "bg-lavender-200",
          "dark:bg-background/70",
        )}>
          {canEditMessage && (
            <ActionTooltip label="Edit">
              <Pencil className="w-4 h-4 text-icon-muted-foreground hover:text-lavender-800 dark:hover:text-white transition cursor-pointer" onClick={() => setIsEditing(true)} />
            </ActionTooltip>
          )}
          <ActionTooltip label="Delete">
            <Trash className="w-4 h-4 text-icon-muted-foreground hover:text-lavender-800 dark:hover:text-white transition cursor-pointer" onClick={() => onOpen("deleteMessage", { apiUrl: `${socketUrl}/${id}`, query: socketQuery })} />
          </ActionTooltip>
        </div>
      )}
    </div>
  )
}

export default ChatItem