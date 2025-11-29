"use client"

import { Member, MemberRole, Profile } from "@prisma/client"
import UserAvatar from "@/components/user-avatar"
import { ActionTooltip } from "@/components//action-tooltip"
import { Pencil, Trash, Loader2, Smile, Pin, PinOff } from "lucide-react"
import Image from "next/image"
import { useEffect, useState, useRef, useCallback } from "react"
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
import { PollWithOptionsAndVotes, MessageReactionWithMember } from "@/types"
import { RoleIcon } from "@/components/role-icon"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"
import { ChatImageLightbox } from "@/components/chat/chat-image-lightbox"
import { FormattingToolbar } from "@/components/chat/formatting-toolbar"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import data from "@emoji-mart/data"
import Picker from "@emoji-mart/react"
import { useTheme } from "next-themes"

interface ChatItemProps {
  id: string,
  content: string,
  member: Member & { profile: Profile },
  timestamp: string,
  fileUrl: string | null,
  deleted: boolean,
  currentMember: Member & { profile: Profile },
  isUpdated: boolean,
  socketUrl: string,
  socketQuery: Record<string, string>,
  poll?: PollWithOptionsAndVotes | null,
  status?: "pending" | "failed" | "sent",
  onRetry?: () => void,
  isRetrying?: boolean,
  isUnread?: boolean,
  reactions?: MessageReactionWithMember[],
  pinned?: boolean,
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
  reactions = [],
  pinned = false,
}: ChatItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const [isReacting, setIsReacting] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [isMouseOverPicker, setIsMouseOverPicker] = useState(false);
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isPinning, setIsPinning] = useState(false);
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const selectionRangeRef = useRef<{ start: number; end: number } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const editInputElementRef = useRef<HTMLInputElement | null>(null);
  const { onOpen } = useModal();
  const router = useRouter();
  const params = useParams();
  const { resolvedTheme } = useTheme();

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

  const updateSelectionPosition = useCallback(() => {
    const input = editInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const hasTextSelected = start !== end;

    if (hasTextSelected) {
      // Store the selection range
      selectionRangeRef.current = { start, end };
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const currentInput = editInputRef.current;
        if (!currentInput) return;

        const currentStart = currentInput.selectionStart || 0;
        const currentEnd = currentInput.selectionEnd || 0;
        if (currentStart !== start || currentEnd !== end) return;

        // Calculate selection position for input elements
        const inputRect = currentInput.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(currentInput);
        const textBeforeSelection = currentInput.value.substring(0, currentStart);

        // Create a temporary span to measure text width
        const measureSpan = document.createElement("span");
        measureSpan.style.position = "absolute";
        measureSpan.style.visibility = "hidden";
        measureSpan.style.whiteSpace = "pre";
        measureSpan.style.font = computedStyle.font;
        measureSpan.style.fontSize = computedStyle.fontSize;
        measureSpan.style.fontFamily = computedStyle.fontFamily;
        measureSpan.style.fontWeight = computedStyle.fontWeight;
        measureSpan.style.letterSpacing = computedStyle.letterSpacing;
        measureSpan.style.textTransform = computedStyle.textTransform;
        measureSpan.textContent = textBeforeSelection;
        document.body.appendChild(measureSpan);

        const textWidth = measureSpan.offsetWidth;

        // Measure selected text width
        const selectedText = currentInput.value.substring(currentStart, currentEnd);
        measureSpan.textContent = selectedText;
        const selectedWidth = Math.max(measureSpan.offsetWidth, 1);

        document.body.removeChild(measureSpan);

        // Calculate position relative to viewport
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
        const x = inputRect.left + paddingLeft + borderLeft + textWidth;
        const y = inputRect.top;

        setSelectionPosition({ x, y, width: selectedWidth });
      }, 0);
    } else {
      setSelectionPosition(null);
      selectionRangeRef.current = null;
    }
  }, []);

  const insertMarkdown = useCallback((markdown: string) => {
    const input = editInputRef.current;
    if (!input) return;

    // Restore selection if it was lost
    if (selectionRangeRef.current && input.selectionStart === input.selectionEnd) {
      input.setSelectionRange(selectionRangeRef.current.start, selectionRangeRef.current.end);
      input.focus();
    }

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = form.getValues("content");
    const selectedText = currentValue.substring(start, end);

    let newValue: string;
    let newCursorPos: number;

    // Handle different markdown insertion patterns
    if (markdown === "**" || markdown === "*" || markdown === "||") {
      // Wrap selected text or insert markers
      if (selectedText) {
        newValue =
          currentValue.substring(0, start) +
          `${markdown}${selectedText}${markdown}` +
          currentValue.substring(end);
        newCursorPos = start + markdown.length + selectedText.length + markdown.length;
      } else {
        newValue =
          currentValue.substring(0, start) +
          `${markdown}${markdown}` +
          currentValue.substring(end);
        newCursorPos = start + markdown.length;
      }
    } else if (markdown === "> ") {
      // Quote: insert at start of line
      const lineStart = currentValue.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = currentValue.indexOf("\n", end);
      const lineEndPos = lineEnd === -1 ? currentValue.length : lineEnd;
      const line = currentValue.substring(lineStart, lineEndPos);

      if (line.startsWith("> ")) {
        // Remove quote if already quoted
        newValue =
          currentValue.substring(0, lineStart) +
          line.substring(2) +
          currentValue.substring(lineEndPos);
        newCursorPos = start - 2;
      } else {
        // Add quote
        newValue =
          currentValue.substring(0, lineStart) +
          "> " +
          line +
          currentValue.substring(lineEndPos);
        newCursorPos = start + 2;
      }
    } else if (markdown === "[text](url)") {
      // Link: replace selected text or insert template
      if (selectedText) {
        newValue =
          currentValue.substring(0, start) +
          `[${selectedText}](url)` +
          currentValue.substring(end);
        newCursorPos = start + selectedText.length + 3; // Position after selected text, before "url"
      } else {
        newValue =
          currentValue.substring(0, start) +
          "[text](url)" +
          currentValue.substring(end);
        newCursorPos = start + 1; // Position after "["
      }
    } else {
      // Default: just insert
      newValue =
        currentValue.substring(0, start) +
        markdown +
        currentValue.substring(end);
      newCursorPos = start + markdown.length;
    }

    form.setValue("content", newValue);

    // Clear selection
    selectionRangeRef.current = null;

    // Restore cursor position after React updates
    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [form]);

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

  // Group reactions by emoji
  const reactionsByEmoji: Record<string, MessageReactionWithMember[]> = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, MessageReactionWithMember[]>);

  const handleReaction = async (emoji: string) => {
    try {
      setIsReacting(true);
      setIsReactionPickerOpen(false);
      const url = qs.stringifyUrl({
        url: `/api/messages/${id}/reactions`,
        query: socketQuery,
      });
      await axios.post(url, { emoji });
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
    } finally {
      setIsReacting(false);
    }
  };

  const hasUserReacted = (emoji: string) => {
    return reactionsByEmoji[emoji]?.some((r: MessageReactionWithMember) => r.memberId === currentMember.id) || false;
  };

  const handlePinToggle = async () => {
    try {
      setIsPinning(true);
      const url = qs.stringifyUrl({
        url: `/api/messages/${id}/pin`,
        query: socketQuery,
      });
      await axios.patch(url);
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    } finally {
      setIsPinning(false);
    }
  };

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
          <UserAvatar src={member.profile.email} imageUrl={member.profile.imageUrl} />
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
            {pinned && (
              <ActionTooltip label="Pinned">
                <Pin className="w-4 h-4 text-mana-400" />
              </ActionTooltip>
            )}
            {isUnread && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-atomicorange-600">
                Unread
              </span>
            )}
          </div>

          {isImage && fileUrl && (
            <>
              <button
                type="button"
                className="relative rounded-md overflow-hidden border flex items-center justify-center bg-secondary max-w-fit max-h-fit mt-1 cursor-zoom-in"
                onClick={() => setIsImageLightboxOpen(true)}
                aria-label="Open image in fullscreen"
              >
                <Image src={fileUrl} alt="Content" width={400} height={400} className="object-contain" />
              </button>
              <ChatImageLightbox
                open={isImageLightboxOpen}
                onOpenChange={setIsImageLightboxOpen}
                src={fileUrl}
                alt="Content"
              />
            </>
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
            <div className={cn(
              "text-sm text-foreground font-medium",
              deleted && "line-through cursor-not-allowed"
            )}>
              {deleted ? (
                <span>{content}</span>
              ) : (
                <MarkdownRenderer
                  content={content}
                  serverId={params?.serverId as string | undefined}
                  currentUserId={currentMember.profile.id}
                  currentUserName={currentMember.profile.name}
                />
              )}
              {isUpdated && !deleted && (
                <span className="text-[12px] mx-2 text-foreground/80">
                  (edited)
                </span>
              )}
            </div>
          )}
          {!fileUrl && isEditing && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-x-2 pt-2 w-full">
                <FormField control={form.control} name="content" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="relative w-full">
                        <FormattingToolbar
                          onFormat={insertMarkdown}
                          open={!!selectionPosition}
                          onOpenChange={(open) => {
                            if (!open) {
                              setSelectionPosition(null)
                            }
                          }}
                          selectionPosition={selectionPosition}
                        >
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-6 w-6"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                editInputRef.current?.focus();
                              }}
                            >
                              <span className="text-[10px] font-bold">Aa</span>
                            </Button>
                          </div>
                        </FormattingToolbar>
                        <Input
                          disabled={isLoading}
                          {...field}
                          ref={(e) => {
                            field.ref(e);
                            editInputRef.current = e;
                            editInputElementRef.current = e;
                          }}
                          className="pl-8 p-2 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200"
                          placeholder="Edit message"
                          onFocus={() => {
                            // Restore selection if we have one stored
                            if (selectionRangeRef.current) {
                              setTimeout(() => {
                                const input = editInputRef.current;
                                if (input && selectionRangeRef.current) {
                                  input.setSelectionRange(selectionRangeRef.current.start, selectionRangeRef.current.end);
                                  updateSelectionPosition();
                                }
                              }, 0);
                            }
                          }}
                          onSelect={() => {
                            // Only update when there's a selection
                            const input = editInputRef.current;
                            if (input) {
                              const start = input.selectionStart || 0;
                              const end = input.selectionEnd || 0;
                              if (start !== end) {
                                updateSelectionPosition();
                              } else {
                                setSelectionPosition(null);
                                selectionRangeRef.current = null;
                              }
                            }
                          }}
                          onBlur={() => {
                            // Delay to allow toolbar button clicks
                            const input = editInputElementRef.current;
                            setTimeout(() => {
                              const activeElement = document.activeElement;
                              // Check if focus moved to toolbar or is still on input
                              if (input && activeElement !== input && !input.contains(activeElement)) {
                                // Check if focus is on a toolbar button
                                const isToolbarButton = activeElement?.closest('[data-slot="popover-content"]');
                                if (!isToolbarButton) {
                                  setSelectionPosition(null);
                                }
                              }
                            }, 150);
                          }}
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
                <Button size="sm" type="submit" className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md" disabled={isLoading}>Save</Button>
                <Button size="sm" type="button" className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md" onClick={() => {
                  setIsEditing(false);
                  setSelectionPosition(null);
                }} disabled={isLoading}>Cancel</Button>
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

          {/* Reactions */}
          {!deleted && Object.keys(reactionsByEmoji).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(reactionsByEmoji).map(([emoji, reactionList]) => {
                const count = reactionList.length;
                const userHasReacted = hasUserReacted(emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReaction(emoji)}
                    disabled={isReacting}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-sm transition",
                      userHasReacted && "bg-mana-200 dark:bg-mana-700 border border-mana-500/50 dark:hover:bg-mana-800 hover:bg-mana-300",
                      !userHasReacted && "bg-lavender-200 dark:bg-lavender-800 border border-lavender-400 dark:hover:border-lavender-600 hover:bg-lavender-300"
                    )}
                  >
                    <span>{emoji}</span>
                    <span className="text-xs font-medium">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!deleted && (
        <>
          <div className={cn(
            "hidden group-hover:flex items-center gap-x-2 absolute p-1 -top-2 right-5 rounded-sm border border-border",
            "bg-lavender-200",
            "dark:bg-background/70",
          )}>
            <ActionTooltip label="Add Reaction">
              <button
                ref={buttonRef}
                type="button"
                className="outline-none border-none bg-transparent p-0 cursor-pointer flex items-center justify-center"
                aria-label="Add Reaction"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isReactionPickerOpen && buttonRef.current) {
                    const rect = buttonRef.current.getBoundingClientRect();
                    setAnchorPosition({
                      x: rect.left + rect.width / 2,
                      y: rect.top
                    });
                  }
                  setIsReactionPickerOpen(!isReactionPickerOpen);
                }}
              >
                <Smile className="w-4 h-4 text-icon-muted-foreground hover:text-lavender-800 dark:hover:text-white transition" />
              </button>
            </ActionTooltip>
            <ActionTooltip label={pinned ? "Unpin" : "Pin"}>
              <button
                type="button"
                className="outline-none border-none bg-transparent p-0 cursor-pointer flex items-center justify-center"
                aria-label={pinned ? "Unpin" : "Pin"}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePinToggle();
                }}
                disabled={isPinning}
              >
                {pinned ? (
                  <PinOff className="w-4 h-4 text-icon-muted-foreground hover:text-lavender-800 dark:hover:text-white transition" />
                ) : (
                  <Pin className="w-4 h-4 text-icon-muted-foreground hover:text-lavender-800 dark:hover:text-white transition" />
                )}
              </button>
            </ActionTooltip>
            {canDeleteMessage && (
              <>
                {canEditMessage && (
                  <ActionTooltip label="Edit">
                    <Pencil className="w-4 h-4 text-icon-muted-foreground hover:text-lavender-800 dark:hover:text-white transition cursor-pointer" onClick={() => setIsEditing(true)} />
                  </ActionTooltip>
                )}
                <ActionTooltip label="Delete">
                  <Trash className="w-4 h-4 text-icon-muted-foreground hover:text-lavender-800 dark:hover:text-white transition cursor-pointer" onClick={() => onOpen("deleteMessage", { apiUrl: `${socketUrl}/${id}`, query: socketQuery })} />
                </ActionTooltip>
              </>
            )}
          </div>

          {/* Popover rendered outside hover container with stable anchor */}
          {isReactionPickerOpen && anchorPosition && (
            <Popover open={isReactionPickerOpen} onOpenChange={(open) => {
              setIsReactionPickerOpen(open);
              if (!open) {
                setAnchorPosition(null);
              }
            }} modal={false}>
              <PopoverAnchor asChild>
                <div
                  ref={anchorRef}
                  style={{
                    position: 'fixed',
                    left: `${anchorPosition.x}px`,
                    top: `${anchorPosition.y}px`,
                    width: 0,
                    height: 0,
                    pointerEvents: 'none',
                    zIndex: 0
                  }}
                />
              </PopoverAnchor>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={8}
                className="bg-transparent border-none shadow-none drop-shadow-none p-0 w-auto z-[100]"
                onMouseEnter={() => setIsMouseOverPicker(true)}
                onMouseLeave={() => setIsMouseOverPicker(false)}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => {
                  const target = e.target as HTMLElement;
                  // Check if click is inside the picker or its container
                  if (
                    pickerRef.current?.contains(target) ||
                    target.closest('.emoji-mart') ||
                    target.closest('[data-slot="popover-content"]') ||
                    target.closest('em-emoji-picker')
                  ) {
                    e.preventDefault();
                    return;
                  }
                  // Only close if mouse is not over picker
                  if (!isMouseOverPicker) {
                    setIsReactionPickerOpen(false);
                    setAnchorPosition(null);
                  }
                }}
                onInteractOutside={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    pickerRef.current?.contains(target) ||
                    target.closest('.emoji-mart') ||
                    target.closest('[data-slot="popover-content"]') ||
                    target.closest('em-emoji-picker')
                  ) {
                    e.preventDefault();
                    return;
                  }
                }}
              >
                <div
                  ref={pickerRef}
                  onMouseEnter={() => setIsMouseOverPicker(true)}
                  onMouseLeave={() => setIsMouseOverPicker(false)}
                  className="relative"
                >
                  <Picker
                    theme={resolvedTheme}
                    data={data}
                    onEmojiSelect={(emoji: { native: string }) => {
                      handleReaction(emoji.native);
                      setIsReactionPickerOpen(false);
                      setAnchorPosition(null);
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}
        </>
      )}
    </div>
  )
}

export default ChatItem