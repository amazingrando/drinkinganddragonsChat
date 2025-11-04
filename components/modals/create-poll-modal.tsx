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
})

const CreatePollModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()

  const isModalOpen = isOpen && type === "createPoll"
  const { query } = data || {}

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      options: ["", ""],
      allowMultipleChoices: false,
      allowAddOptions: false,
      durationType: "none",
      durationValue: "",
    },
  })

  const [optionErrors, setOptionErrors] = useState<string[]>([])

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

  // Generate unique IDs for each option
  const [optionIds, setOptionIds] = useState<string[]>(() => {
    return watchOptions.map((_, index) => `option-${Date.now()}-${index}`)
  })

  // Sync optionIds with options length
  useEffect(() => {
    if (optionIds.length !== watchOptions.length) {
      const newIds = watchOptions.map((_, index) => {
        if (index < optionIds.length) {
          return optionIds[index]
        }
        return `option-${Date.now()}-${index}`
      })
      setOptionIds(newIds)
    }
  }, [optionIds, watchOptions, watchOptions.length])

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
    try {
      // Validate options
      const validOptions = values.options.filter(opt => opt.trim().length > 0)
      if (validOptions.length < 2) {
        setOptionErrors(["At least 2 options are required"])
        return
      }

      // Calculate end date
      let endDate: string | undefined = undefined
      let durationHours: number | undefined = undefined
      let durationDays: number | undefined = undefined

      if (values.durationType === "hours" && values.durationValue) {
        durationHours = parseInt(values.durationValue)
      } else if (values.durationType === "days" && values.durationValue) {
        durationDays = parseInt(values.durationValue)
      } else if (values.durationType === "date" && values.durationValue) {
        endDate = values.durationValue
      }

      const url = qs.stringifyUrl({
        url: "/api/polls",
        query: query as Record<string, string>,
      })

      // Get option IDs in current order (optionIds already matches watchOptions order)
      const orderedOptionIds = validOptions.map((opt) => {
        const index = watchOptions.indexOf(opt)
        return index >= 0 && index < optionIds.length ? optionIds[index] : `option-${Date.now()}`
      })

      await axios.post(url, {
        title: values.title,
        options: validOptions,
        optionOrder: orderedOptionIds,
        allowMultipleChoices: values.allowMultipleChoices,
        allowAddOptions: values.allowAddOptions,
        durationHours,
        durationDays,
        endDate,
      })

      form.reset()
      setOptionErrors([])
      router.refresh()
      onClose()
    } catch (error) {
      console.error(error)
    }
  }

  const handleClose = () => {
    form.reset()
    setOptionErrors([])
    onClose()
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <ModalHeader title="Create a Poll" description="Create a poll for members to vote on." />

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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            </div>
            <DialogFooter className="px-6 py-4">
              <Button disabled={isLoading} variant="primary">Create Poll</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default CreatePollModal

