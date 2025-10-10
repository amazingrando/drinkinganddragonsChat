'use client'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ActionTooltip } from '@/components/action-tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'

interface NavigationItemProps {
  id: string
  name: string
  imageUrl: string
}

export const NavigationItem = ({
  id,
  name,
  imageUrl,
}: NavigationItemProps) => {
  const params = useParams()
  const router = useRouter()

  return (
    <ActionTooltip label={name} side='right' align='center'>
      <button className='group flex items-center' onClick={() => { }}>
        <div className={cn("absolute left-0 bg-primary rounded-r-full transition-all w-[4px]",
          params.serverId != id && "group-hover:h-[20px]",
          params.serverId === id ? "h-[36px]" : "h-[8px]",
        )} />
        <div className={cn(
          "relative group flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden items-center justify-center",
          params.serverId === id ? "bg-primary/10 text-primary rounded-[16px]" : "bg-transparent",
        )}>
          <Image
            src={imageUrl}
            alt='Channel'
            fill
            className='object-cover'
          />
        </div>
      </button>
    </ActionTooltip>
  )
}

export default NavigationItem