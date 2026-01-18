import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  delay?: number
  className?: string
  /** Use animate instead of whileInView for above-the-fold content (fixes Safari mobile timing issues) */
  animateOnMount?: boolean
  /** Disable Y movement to prevent layout shift on page refresh */
  noYMovement?: boolean
}

export function FadeIn({
  children,
  delay = 0,
  className = '',
  animateOnMount = false,
  noYMovement = false,
}: FadeInProps) {
  const shouldReduceMotion = useReducedMotion()

  const initial = shouldReduceMotion
    ? {}
    : { opacity: 0, ...(noYMovement ? {} : { y: 20 }) }
  const animateTo = { opacity: 1, y: 0 }

  if (animateOnMount) {
    return (
      <motion.div
        initial={initial}
        animate={animateTo}
        transition={{ duration: 0.5, delay, ease: 'easeOut' }}
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
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
