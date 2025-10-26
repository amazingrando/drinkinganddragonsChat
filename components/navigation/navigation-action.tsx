'use client'

import { Plus } from 'lucide-react'
import { ActionTooltip } from '@/components/action-tooltip'
import { useModal } from '@/hooks/use-modal-store'

const NavigationAction = () => {
  const { onOpen } = useModal()

  const handleClick = () => {
    onOpen("createServer")
  }

  return (
    <div>
      <ActionTooltip label='Add a server' side='right' align='center'>
        <button className='group flex items-center' onClick={handleClick}>
          <div className='flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all items-center justify-center bg-lavender-900 group-hover:bg-mana-400'>
            <Plus className='group-hover:text-white transition text-mana-400' size={25} />
          </div>
        </button>
      </ActionTooltip>
    </div>
  )
}

export default NavigationAction