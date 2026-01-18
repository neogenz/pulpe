import { motion, useReducedMotion } from 'framer-motion'
import { Screenshot } from './Screenshot'

interface HeroScreenshotProps {
  screenshotSrc?: string
  screenshotLabel: string
}

export function HeroScreenshot({
  screenshotSrc,
  screenshotLabel,
}: HeroScreenshotProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <Screenshot src={screenshotSrc} label={screenshotLabel} />
    </motion.div>
  )
}
