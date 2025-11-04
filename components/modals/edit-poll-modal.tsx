"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useRouter } from "next/navigation"
import { ModalHeader } from "./_modal-header"
import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { SortablePollOption } from "./sortable-poll-option"

import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useModal } from "@/hooks/use-modal-store"
import qs from "query-string"
import { PollWithOptionsAndVotes } from "@/types"
import { MemberRole } from "@prisma/client"

const formSchema = z.object({
  title: z.string().min(1, {
    message: "Poll title is required",
  }),
  options: z.array(z.string()).min(2, {
    message: "At least 2 options are required",
  }),
  allowMultipleChoices: z.boolean().default(false),
  allowAddOptions: z.boolean().default(false),
  durationType: z.enum(["none", "hours", "days", "date"]).default("none"),
  durationValue: z.string().optional(),
  closePoll: z.boolean().default(false),
})

const EditPollModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()

  const isModalOpen = isOpen && type === "editPoll"
  const { poll, query, currentMemberId, currentMemberRole } = data || {}
  const pollData = poll as PollWithOptionsAndVotes | undefined

  // Check if user can close the poll (owner or admin)
  const isOwner = pollData?.creatorId === currentMemberId
  const isAdmin = currentMemberRole === MemberRole.ADMIN
  const canClosePoll = (isOwner || isAdmin) && pollData?.closedAt === null

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      options: ["", ""],
      allowMultipleChoices: false,
      allowAddOptions: false,
      durationType: "none" as const,
      durationValue: "",
      closePoll: false,
    },
  })

  const [optionErrors, setOptionErrors] = useState<string[]>([])

  // Initialize form with poll data
  useEffect(() => {
    if (pollData) {
      // Sort options by optionOrder if available, otherwise use existing order
      const sortedOptions = [...pollData.options]
      if (pollData.optionOrder && Array.isArray(pollData.optionOrder)) {
        const orderMap = new Map(pollData.optionOrder.map((id, index) => [id, index]))
        sortedOptions.sort((a, b) => {
          const aIndex = orderMap.get(a.id) ?? 999
          const bIndex = orderMap.get(b.id) ?? 999
          return aIndex - bIndex
        })
      }
      const options = sortedOptions.map(opt => opt.text)

      // Determine duration type and value
      let durationType: "none" | "hours" | "days" | "date" = "none"
      let durationValue = ""

      if (pollData.endsAt) {
        const now = new Date()
        const endsAt = new Date(pollData.endsAt)
        const diffMs = endsAt.getTime() - now.getTime()

        if (diffMs > 0) {
          // For existing polls with end dates, use "date" type
          durationType = "date"
          // Format datetime-local format: YYYY-MM-DDTHH:mm
          const localDate = new Date(endsAt.getTime() - endsAt.getTimezoneOffset() * 60000)
          durationValue = localDate.toISOString().slice(0, 16)
        }
      }

      form.setValue("title", pollData.title)
      form.setValue("options", options.length > 0 ? options : ["", ""])
      form.setValue("allowMultipleChoices", pollData.allowMultipleChoices)
      form.setValue("allowAddOptions", pollData.allowAddOptions)
      form.setValue("durationType", durationType)
      form.setValue("durationValue", durationValue)
      form.setValue("closePoll", false) // Always start with false

      // Set option IDs to match the sorted options
      if (sortedOptions.length > 0) {
        setOptionIds(sortedOptions.map(opt => opt.id))
      }
    }
  }, [pollData, form])

  const isLoading = form.formState.isSubmitting

  const watchOptions = form.watch("options")
  const watchDurationType = form.watch("durationType")

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Generate unique IDs for each option - use existing option IDs if available, otherwise generate new ones
  const [optionIds, setOptionIds] = useState<string[]>(() => {
    if (pollData?.options && pollData.options.length > 0) {
      // Use existing option IDs from the poll
      return pollData.options.map((opt) => opt.id)
    }
    return watchOptions.map((_, index) => `option-${Date.now()}-${index}`)
  })

  // Sync optionIds when pollData changes or options length changes
  useEffect(() => {
    if (pollData?.options && pollData.options.length > 0 && watchOptions.length === pollData.options.length) {
      // If we have poll data and the lengths match, use the existing IDs
      const existingIds = pollData.options.map((opt) => opt.id)
      if (JSON.stringify(existingIds) !== JSON.stringify(optionIds)) {
        setOptionIds(existingIds)
      }
    } else if (optionIds.length !== watchOptions.length) {
      // If lengths don't match, generate new IDs for new options
      const newIds = watchOptions.map((_, index) => {
        if (index < optionIds.length) {
          return optionIds[index]
        }
        return `option-${Date.now()}-${index}`
      })
      setOptionIds(newIds)
    }
  }, [optionIds, pollData, watchOptions, watchOptions.length])

  const addOption = () => {
    const options = form.getValues("options")
    const newId = `option-${Date.now()}-${options.length}`
    form.setValue("options", [...options, ""])
    setOptionIds([...optionIds, newId])
  }

  const removeOption = (index: number) => {
    const options = form.getValues("options")
    if (options.length > 2) {
      form.setValue("options", options.filter((_, i) => i !== index))
      setOptionIds(optionIds.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const options = form.getValues("options")
    const newOptions = [...options]
    newOptions[index] = value
    form.setValue("options", newOptions)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = optionIds.indexOf(active.id as string)
      const newIndex = optionIds.indexOf(over.id as string)

      const newOptionIds = arrayMove(optionIds, oldIndex, newIndex)
      const newOptions = arrayMove(watchOptions, oldIndex, newIndex)

      setOptionIds(newOptionIds)
      form.setValue("options", newOptions)
    }
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!pollData) {
      return
    }

    try {
      // Validate options
      const validOptions = values.options.filter(opt => opt.trim().length > 0)
      if (validOptions.length < 2) {
        setOptionErrors(["At least 2 options are required"])
        return
      }

      // Calculate end date
      let endDate: string | null | undefined = undefined
      let durationHours: number | undefined = undefined
      let durationDays: number | undefined = undefined

      if (values.durationType === "hours" && values.durationValue) {
        durationHours = parseInt(values.durationValue)
      } else if (values.durationType === "days" && values.durationValue) {
        durationDays = parseInt(values.durationValue)
      } else if (values.durationType === "date" && values.durationValue) {
        endDate = values.durationValue
      } else if (values.durationType === "none") {
        // Clear end date - send null to explicitly remove it
        endDate = null
        durationHours = undefined
        durationDays = undefined
      }

      // Check if there are any changes to poll properties
      // Note: We check if any field differs, or if close poll is requested (which needs poll to be open)
      const hasTitleChange = values.title !== pollData.title
      const hasOptionsChange = JSON.stringify(validOptions) !== JSON.stringify(pollData.options.map(opt => opt.text))
      const hasSettingsChange = values.allowMultipleChoices !== pollData.allowMultipleChoices ||
        values.allowAddOptions !== pollData.allowAddOptions
      const hasDurationChange = durationHours !== undefined ||
        durationDays !== undefined ||
        endDate !== undefined ||
        (values.durationType === "none" && pollData.endsAt !== null)

      const hasChanges = hasTitleChange || hasOptionsChange || hasSettingsChange || hasDurationChange

      if (hasChanges) {
        const url = qs.stringifyUrl({
          url: `/api/polls/${pollData.id}`,
          query: query as Record<string, string>,
        })

        // Get option IDs in current order (optionIds already matches watchOptions order)
        const orderedOptionIds = validOptions.map((opt) => {
          const index = watchOptions.indexOf(opt)
          return index >= 0 && index < optionIds.length ? optionIds[index] : `option-${Date.now()}`
        })

        await axios.patch(url, {
          title: values.title,
          options: validOptions,
          optionOrder: orderedOptionIds,
          allowMultipleChoices: values.allowMultipleChoices,
          allowAddOptions: values.allowAddOptions,
          durationHours,
          durationDays,
          endDate,
        })
      }

      // Then, close the poll if requested
      if (values.closePoll && canClosePoll) {
        const closeUrl = qs.stringifyUrl({
          url: `/api/polls/${pollData.id}/close`,
          query: query as Record<string, string>,
        })

        await axios.patch(closeUrl)
      }

      form.reset()
      setOptionErrors([])
      router.refresh()
      onClose()
    } catch (error: unknown) {
      console.error("Edit poll error:", error)
      if (axios.isAxiosError(error) && error.response) {
        console.error("Error response:", error.response.data)
        setOptionErrors([error.response.data?.message || error.response.data?.error || "Failed to update poll"])
      } else if (error instanceof Error) {
        console.error("Error details:", error)
        setOptionErrors([error.message || "Failed to update poll"])
      } else {
        setOptionErrors(["Failed to update poll"])
      }
    }
  }

  const handleClose = () => {
    form.reset()
    setOptionErrors([])
    onClose()
  }

  if (!pollData) {
    return null
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <ModalHeader title="Edit Poll" description="Edit the poll details and options." />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold">Poll title</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      placeholder="What do you want to poll about?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div>
                <FormLabel className="uppercase text-xs font-bold">Poll options</FormLabel>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={optionIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 mt-2">
                      {watchOptions.map((option, index) => (
                        <SortablePollOption
                          key={optionIds[index]}
                          id={optionIds[index]}
                          index={index}
                          value={option}
                          disabled={isLoading}
                          placeholder={`Option ${index + 1}`}
                          onChange={(value) => updateOption(index, value)}
                          onRemove={watchOptions.length > 2 ? () => removeOption(index) : undefined}
                          showRemove={watchOptions.length > 2}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isLoading}
                  onClick={addOption}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
                {optionErrors.length > 0 && (
                  <div className="text-sm text-red-500 mt-1">{optionErrors[0]}</div>
                )}
              </div>

              <FormField control={form.control} name="allowMultipleChoices" render={({ field }) => (
                <FormItem className="flex items-center gap-x-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-semibold">Allow multiple choices</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Let people vote for multiple options
                    </p>
                  </div>
                </FormItem>
              )} />

              <FormField control={form.control} name="allowAddOptions" render={({ field }) => (
                <FormItem className="flex items-center gap-x-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-semibold">Allow others to add options</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Let people add their own options
                    </p>
                  </div>
                </FormItem>
              )} />

              <FormField control={form.control} name="durationType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold">Poll duration</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No time limit</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="date">Specific date</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {watchDurationType !== "none" && (
                <FormField control={form.control} name="durationValue" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      {watchDurationType === "date" ? (
                        <Input
                          type="datetime-local"
                          disabled={isLoading}
                          {...field}
                        />
                      ) : (
                        <Input
                          type="number"
                          disabled={isLoading}
                          placeholder={watchDurationType === "hours" ? "Number of hours" : "Number of days"}
                          {...field}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {canClosePoll && (
                <FormField control={form.control} name="closePoll" render={({ field }) => (
                  <FormItem className="flex items-center gap-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-semibold">Close poll</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Close this poll after saving changes
                      </p>
                    </div>
                  </FormItem>
                )} />
              )}
            </div>
            <DialogFooter className="px-6 py-4">
              <Button disabled={isLoading} variant="primary">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditPollModal

