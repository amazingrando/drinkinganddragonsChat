"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FormControl } from "@/components/ui/form"
import { cn } from "@/lib/utils"

interface SortablePollOptionProps {
  id: string
  index: number
  value: string
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
  onRemove?: () => void
  showRemove?: boolean
}

export const SortablePollOption = ({
  id,
  index,
  value,
  disabled,
  placeholder,
  onChange,
  onRemove,
  showRemove = false,
}: SortablePollOptionProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        className={cn(
          "cursor-grab active:cursor-grabbing touch-none",
          "text-muted-foreground hover:text-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <FormControl>
        <Input
          disabled={disabled}
          placeholder={placeholder || `Option ${index + 1}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </FormControl>
      {showRemove && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onRemove}
          className="flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
