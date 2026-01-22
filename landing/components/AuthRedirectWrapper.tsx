'use client'

import { useEffect } from 'react'
import { isAuthenticated } from '@/lib/auth'

interface AuthRedirectWrapperProps {
  children: React.ReactNode
}

export function AuthRedirectWrapper({ children }: AuthRedirectWrapperProps) {
  useEffect(() => {
    async function checkAuth() {
      const authenticated = await isAuthenticated()
      if (authenticated) {
        window.location.replace('/dashboard')
      }
    }
    checkAuth()
  }, [])

  return <>{children}</>
}
