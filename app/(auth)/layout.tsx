import React from 'react'

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='flex items-center justify-center h-screen bg-muted text-muted-foreground'>{children}</div>
  )
}

export default Layout