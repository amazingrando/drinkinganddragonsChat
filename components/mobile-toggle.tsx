"use client"

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { Button } from "./ui/button"
import { ReactNode } from "react"

interface MobileToggleProps {
  navigationSidebar: ReactNode
  serverSidebar: ReactNode
}

export const MobileToggle = ({ navigationSidebar, serverSidebar }: MobileToggleProps) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 flex flex-row gap-0 overflow-hidden w-[90vw]" hideClose>
        <div className="w-[72px]">
          {navigationSidebar}
        </div>
        {serverSidebar}
      </SheetContent>
    </Sheet>
  )
}