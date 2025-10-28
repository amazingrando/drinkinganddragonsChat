import React from 'react'

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='h-full bg-lavender-300'>
      {children}
    </div>
  )
}

export default AuthLayout