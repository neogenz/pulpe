'use client'

import { LazyMotion, domAnimation } from 'framer-motion'
import type { ReactNode } from 'react'

interface MotionProviderProps {
  children: ReactNode
}

/**
 * Wraps the app with LazyMotion to reduce Framer Motion bundle size.
 * Uses domAnimation (lighter) instead of full animation features.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}
