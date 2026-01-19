import { memo, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  delay?: number
  className?: string
  animateOnMount?: boolean
  noYMovement?: boolean
}

const VIEWPORT_CONFIG = { once: true, margin: '-50px' } as const

export const FadeIn = memo(function FadeIn({
  children,
  delay = 0,
  className = '',
  animateOnMount = false,
  noYMovement = false,
}: FadeInProps) {
  const shouldReduceMotion = useReducedMotion()

  const initial = useMemo(
    () =>
      shouldReduceMotion
        ? {}
        : { opacity: 0, ...(noYMovement ? {} : { y: 20 }) },
    [shouldReduceMotion, noYMovement]
  )

  const transition = useMemo(
    () => ({ duration: 0.5, delay, ease: 'easeOut' as const }),
    [delay]
  )

  const animateTo = { opacity: 1, y: 0 }

  if (animateOnMount) {
    return (
      <motion.div
        initial={initial}
        animate={animateTo}
        transition={transition}
        className={className}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={initial}
      whileInView={animateTo}
      viewport={VIEWPORT_CONFIG}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  )
})
