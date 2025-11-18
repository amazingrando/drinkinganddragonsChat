'use client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'

interface ActionTooltipProps {
  label: string
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

export const ActionTooltip = ({ label, children, side, align }: ActionTooltipProps) => {
  const isMobile = useIsMobile()

  return (
    <Tooltip delayDuration={50}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} hidden={isMobile}>
        <p className='font-semibold text-sm capitalize'>{label.toLowerCase()}</p>
      </TooltipContent>
    </Tooltip>
  )
}