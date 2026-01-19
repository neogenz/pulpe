import { memo, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Screenshot } from './Screenshot'

interface HeroScreenshotProps {
  screenshotSrc?: string
  screenshotDesktopSrc?: string
  screenshotLabel: string
}

const TRANSITION = { duration: 0.6, ease: 'easeOut' } as const
const ANIMATE_TO = { opacity: 1, scale: 1 }

export const HeroScreenshot = memo(function HeroScreenshot({
  screenshotSrc,
  screenshotDesktopSrc,
  screenshotLabel,
}: HeroScreenshotProps) {
  const shouldReduceMotion = useReducedMotion()

  const initial = useMemo(
    () => (shouldReduceMotion ? {} : { opacity: 0, scale: 0.95 }),
    [shouldReduceMotion]
  )

  return (
    <motion.div initial={initial} animate={ANIMATE_TO} transition={TRANSITION}>
      <Screenshot
        src={screenshotSrc}
        desktopSrc={screenshotDesktopSrc}
        label={screenshotLabel}
      />
    </motion.div>
  )
})
