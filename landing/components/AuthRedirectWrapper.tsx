'use client'

import { useEffect, useState } from 'react'
import { isAuthenticated } from '@/lib/auth'

interface AuthRedirectWrapperProps {
  children: React.ReactNode
}

/**
 * Client-side auth redirect wrapper.
 * Checks Supabase auth cookie and redirects authenticated users to /dashboard.
 * Shows a brief loading state while checking to avoid content flash.
 */
export function AuthRedirectWrapper({ children }: AuthRedirectWrapperProps) {
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (isAuthenticated()) {
      window.location.replace('/dashboard')
    } else {
      setIsChecking(false)
    }
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
