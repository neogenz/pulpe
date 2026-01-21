'use client'

import { useEffect, useState } from 'react'
import { isAuthenticated } from '@/lib/auth'

interface AuthRedirectWrapperProps {
  children: React.ReactNode
}

/**
 * Client-side auth redirect wrapper.
 * Checks Supabase auth session and redirects authenticated users to /dashboard.
 * Shows a brief loading state while checking to avoid content flash.
 */
export function AuthRedirectWrapper({ children }: AuthRedirectWrapperProps) {
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const authenticated = await isAuthenticated()
      if (authenticated) {
        window.location.replace('/dashboard')
      } else {
        setIsChecking(false)
      }
    }
    checkAuth()
  }, [])

  if (isChecking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
      </div>
    )
  }

  return <>{children}</>
}
