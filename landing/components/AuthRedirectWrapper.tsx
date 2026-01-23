'use client'

import { useEffect } from 'react'
import { isAuthenticated } from '@/lib/auth'

interface AuthRedirectWrapperProps {
  children: React.ReactNode
}

export function AuthRedirectWrapper({ children }: AuthRedirectWrapperProps) {
  useEffect(() => {
    async function checkAuth() {
      try {
        const authenticated = await isAuthenticated()
        if (authenticated) {
          window.location.replace('/dashboard')
        } else {
          document.documentElement.removeAttribute('data-auth-checking')
        }
      } catch {
        document.documentElement.removeAttribute('data-auth-checking')
      }
    }
    checkAuth()
  }, [])

  return <>{children}</>
}
