import { currentProfile } from '@/lib/current-profile'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import NavigationAction from './navigation-action'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NavigationItem } from './navigation-item'
import { ModeToggle } from '@/components/mode-toggle'
import { UserButton } from '@/components/user-button'

const NavigationSidebar = async () => {
  const profile = await currentProfile()

  if (!profile) {
    return redirect("/")
  }

  const servers = await db.server.findMany({
    where: {
      members: {
        some: {
          profileID: profile.id,
        },
      },
    },
  })

  if (!servers.length) {
    return redirect("/")
  }

  return (
    <div data-nav className='space-y-4 flex flex-col items-center h-full w-full bg-lavender-1000 py-3 border-r border-lavender-900 text-white'>
      <NavigationAction />
      <Separator className='h-[3px] bg-lavender-900 rounded-md w-10 mx-auto' />
      <ScrollArea className='flex-1 w-full'>
        {servers.map((server) => (
          <div key={server.id} className='mb-4'>
            <NavigationItem id={server.id} name={server.name} imageUrl={server.imageUrl} />
          </div>
        ))}
      </ScrollArea>

      <div className="pb-3 mt-auto flex flex-col items-center gap-y-4">
        <ModeToggle />
        <UserButton />
      </div>
    </div >
  )
}

export default NavigationSidebar