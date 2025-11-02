"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useRouter } from "next/navigation"
import { ModalHeader } from "./_modal-header"
import { useState, useEffect } from "react"
import { X, Plus } from "lucide-react"

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

const EditPollModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()

  const isModalOpen = isOpen && type === "editPoll"
  const { poll, query } = data || {}
  const pollData = poll as PollWithOptionsAndVotes | undefined

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      options: ["", ""],
      allowMultipleChoices: false,
      allowAddOptions: false,
      durationType: "none" as const,
      durationValue: "",
    },
  })

  const [optionErrors, setOptionErrors] = useState<string[]>([])

  // Initialize form with poll data
  useEffect(() => {
    if (pollData) {
      const options = pollData.options.map(opt => opt.text)
      
      // Determine duration type and value
      let durationType: "none" | "hours" | "days" | "date" = "none"
      let durationValue = ""

      if (pollData.endsAt) {
        const now = new Date()
        const endsAt = new Date(pollData.endsAt)
        const diffMs = endsAt.getTime() - now.getTime()
        
        if (diffMs > 0) {
          // Poll hasn't ended yet, calculate duration
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          const hours = Math.floor(diffMs / (1000 * 60 * 60))
          
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
    }
  }, [pollData, form])

  const isLoading = form.formState.isSubmitting

  const watchOptions = form.watch("options")
  const watchDurationType = form.watch("durationType")

  const addOption = () => {
    const options = form.getValues("options")
    form.setValue("options", [...options, ""])
  }

  const removeOption = (index: number) => {
    const options = form.getValues("options")
    if (options.length > 2) {
      form.setValue("options", options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const options = form.getValues("options")
    const newOptions = [...options]
    newOptions[index] = value
    form.setValue("options", newOptions)
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

      const url = qs.stringifyUrl({
        url: `/api/polls/${pollData.id}`,
        query: query as Record<string, string>,
      })

      await axios.patch(url, {
        title: values.title,
        options: validOptions,
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
    } catch (error: any) {
      console.error("Edit poll error:", error)
      if (error.response) {
        console.error("Error response:", error.response.data)
        setOptionErrors([error.response.data?.message || error.response.data?.error || "Failed to update poll"])
      } else {
        console.error("Error details:", error)
        setOptionErrors([error.message || "Failed to update poll"])
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
                <div className="space-y-2 mt-2">
                  {watchOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          disabled={isLoading}
                          placeholder={`Option ${index + 1}`}
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                        />
                      </FormControl>
                      {watchOptions.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isLoading}
                          onClick={() => removeOption(index)}
                          className="flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
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

