"use client"

import Image from "next/image"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"

interface ChatImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  alt?: string
}

export const ChatImageLightbox = ({
  open,
  onOpenChange,
  src,
  alt = "Message image",
}: ChatImageLightboxProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayVariant="default"
        className={cn(
          "border-none bg-transparent shadow-none p-0",
          "w-screen h-screen max-w-none max-h-none",
          "flex items-center justify-center",
          "md:max-w-none px-8"
        )}
      >
        <DialogTitle className="sr-only">
          {alt}
        </DialogTitle>
        <div
          className="max-w-fit max-h-fit relative flex items-center justify-center"
          aria-label={alt}
        >
          <DialogClose className="absolute top-3 right-3 bg-background/80 rounded-full p-2 hover:bg-background/100 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border border-border">
            <XIcon className="size-6" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={1200}
            // sizes="100vw"
            unoptimized={true}
            className="object-contain rounded-md w-full h-auto"
            priority
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ChatImageLightbox


