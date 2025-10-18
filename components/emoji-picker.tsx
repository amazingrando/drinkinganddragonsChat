"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Smile } from "lucide-react"
import data from "@emoji-mart/data"
import Picker from "@emoji-mart/react";
import { useTheme } from "next-themes"

interface EmojiPickerProps {
  onChange: (emoji: string) => void
}

export const EmojiPicker = ({ onChange }: EmojiPickerProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const { resolvedTheme } = useTheme()

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Smile className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition" />
      </PopoverTrigger>
      <PopoverContent side="right" sideOffset={40} className="bg-transparent border-none shadow-none drop-shadow-none mb-16">
        <Picker
          theme={resolvedTheme}
          data={data}
          onEmojiSelect={(emoji: { native: string }) => onChange(emoji.native)}
        />
      </PopoverContent>
    </Popover>
  )
}