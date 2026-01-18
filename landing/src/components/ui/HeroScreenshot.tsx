import { motion, useReducedMotion } from 'framer-motion'
import { Check, Wallet, TrendingUp } from 'lucide-react'
import { Screenshot } from './Screenshot'
import { FloatingCard } from './FloatingCard'

interface HeroScreenshotProps {
  screenshotSrc?: string
  screenshotLabel: string
}

export function HeroScreenshot({
  screenshotSrc,
  screenshotLabel,
}: HeroScreenshotProps) {
  const shouldReduceMotion = useReducedMotion()

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.15,
      },
    },
  }

  const itemVariants = {
    hidden: shouldReduceMotion
      ? {}
      : { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut' as const,
      },
    },
  }

  return (
    <motion.div
      className="relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Main screenshot */}
      <motion.div variants={itemVariants}>
        <Screenshot src={screenshotSrc} label={screenshotLabel} />
      </motion.div>

      {/* Floating cards - hidden on mobile */}
      {/* Top-right: Highlight card (primary focal point) */}
      <motion.div
        className="absolute -top-6 -right-4 hidden md:block lg:-top-8 lg:-right-8"
        variants={itemVariants}
      >
        <FloatingCard variant="highlight" rotation={-3}>
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5" />
            <div>
              <div className="text-xs opacity-80">Disponible ce mois</div>
              <div className="text-lg font-bold">847 CHF</div>
            </div>
          </div>
        </FloatingCard>
      </motion.div>

      {/* Bottom-left: Notification */}
      <motion.div
        className="absolute -bottom-4 -left-4 hidden md:block lg:-bottom-6 lg:-left-8"
        variants={itemVariants}
      >
        <FloatingCard variant="notification" rotation={2}>
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-primary" />
          </div>
          <span>Transaction ajoutée</span>
        </FloatingCard>
      </motion.div>

      {/* Bottom-right: Stat */}
      <motion.div
        className="absolute -bottom-2 right-6 hidden lg:block"
        variants={itemVariants}
      >
        <FloatingCard variant="stat" rotation={-2}>
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span>+120 CHF épargnés</span>
          </div>
        </FloatingCard>
      </motion.div>
    </motion.div>
  )
}
