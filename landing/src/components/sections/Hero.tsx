import { motion, useReducedMotion } from 'framer-motion'
import {
  Check,
  Wallet,
  TrendingUp,
  ShoppingBag,
  PiggyBank,
  Gamepad2,
} from 'lucide-react'
import {
  Button,
  HeroScreenshot,
  FadeIn,
  ShineBorder,
  TypeWriter,
  GridBackground,
  FloatingCard,
} from '../ui'

const TYPEWRITER_STRINGS = [
  'Profite de ton mois.',
  'Anticipe tes dépenses.',
  'Épargne sans y penser.',
  'Reprends le contrôle.',
]

export function Hero() {
  const shouldReduceMotion = useReducedMotion()

  const floatingVariants = {
    hidden: shouldReduceMotion ? {} : { opacity: 0, scale: 0.8 },
    visible: (delay: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: shouldReduceMotion ? 0 : delay,
        ease: 'easeOut',
      },
    }),
  }

  return (
    <section className="relative min-h-screen flex items-center pt-28 pb-16 md:pt-32 md:pb-24 bg-background overflow-hidden">
      {/* Subtle grid background */}
      <GridBackground />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Floating cards - oval pattern around content */}

        {/* Top-left: diagonal position on oval */}
        <motion.div
          className="absolute -top-10 left-8 hidden lg:block xl:left-4"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={0.2}
        >
          <FloatingCard variant="pill" rotation={-4} animationDelay={-0.5}>
            <ShoppingBag className="w-4 h-4 text-primary" />
            <span>Courses</span>
          </FloatingCard>
        </motion.div>

        {/* Top-center: top of oval */}
        <motion.div
          className="absolute -top-24 left-1/2 -translate-x-1/2 hidden lg:block xl:-top-32"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={0.4}
        >
          <FloatingCard variant="trend" rotation={2} animationDelay={-1}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12%</span>
          </FloatingCard>
        </motion.div>

        {/* Top-right: diagonal position on oval */}
        <motion.div
          className="absolute -top-10 right-8 hidden lg:block xl:right-4"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={0.6}
        >
          <FloatingCard variant="highlight" rotation={4} animationDelay={-1.5}>
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5" />
              <div>
                <div className="text-xs opacity-80">Disponible ce mois</div>
                <div className="text-xl font-bold">847 CHF</div>
              </div>
            </div>
          </FloatingCard>
        </motion.div>

        {/* Left-middle: widest point of oval (far left) */}
        <motion.div
          className="absolute top-1/3 -left-44 hidden xl:block 2xl:-left-56"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={0.8}
        >
          <FloatingCard variant="large" rotation={-3} animationDelay={-2}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-text-secondary">Épargné ce mois</div>
                <div className="text-lg font-bold text-primary">+120 CHF</div>
              </div>
            </div>
          </FloatingCard>
        </motion.div>

        {/* Right-middle: widest point of oval (far right) */}
        <motion.div
          className="absolute top-1/3 -right-32 hidden xl:block 2xl:-right-44"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={1.0}
        >
          <FloatingCard variant="pill" rotation={-2} animationDelay={-2.5}>
            <Gamepad2 className="w-4 h-4 text-primary" />
            <span>Loisirs</span>
          </FloatingCard>
        </motion.div>

        {/* Bottom-left: diagonal position on oval */}
        <motion.div
          className="absolute -bottom-16 -left-4 hidden lg:block xl:-left-12"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={1.2}
        >
          <FloatingCard variant="pill" rotation={3} animationDelay={-3}>
            <PiggyBank className="w-4 h-4 text-primary" />
            <span>Épargne</span>
          </FloatingCard>
        </motion.div>

        {/* Bottom-center: bottom of oval */}
        <motion.div
          className="absolute -bottom-28 left-1/2 -translate-x-1/2 hidden lg:block xl:-bottom-36"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={1.3}
        >
          <FloatingCard variant="trend" rotation={-1} animationDelay={-3.5}>
            <Check className="w-3.5 h-3.5" />
            <span>À jour</span>
          </FloatingCard>
        </motion.div>

        {/* Bottom-right: diagonal position on oval */}
        <motion.div
          className="absolute -bottom-10 right-12 hidden lg:block xl:right-8"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={1.4}
        >
          <FloatingCard variant="notification" rotation={-4} animationDelay={-4}>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-medium">Transaction ajoutée</div>
              <div className="text-xs text-text-secondary">Il y a 2 min</div>
            </div>
          </FloatingCard>
        </motion.div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeIn animateOnMount noYMovement className="text-center md:text-left">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
              L'app budget simple
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-text mb-6">
              Planifie ton année.
              <br />
              {/* Static text on mobile, TypeWriter on desktop */}
              <span className="text-primary md:hidden">
                Profite de ton mois.
              </span>
              <span className="text-primary hidden md:block min-h-[7.5rem] lg:min-h-[9.375rem]">
                <TypeWriter strings={TYPEWRITER_STRINGS} />
              </span>
            </h1>
            <p className="text-lg md:text-xl text-text-secondary mb-8 max-w-lg mx-auto md:mx-0">
              Fini le stress des dépenses oubliées. Anticipe tout et note en 2
              clics.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center md:justify-start">
              <div className="flex flex-col items-center gap-1">
                <ShineBorder
                  color={['#006E25', '#2B883B', '#0061A6']}
                  borderWidth={2}
                  duration={6}
                  className="bg-transparent"
                >
                  <Button>Commencer</Button>
                </ShineBorder>
                <span className="text-xs italic text-text-secondary">C'est gratuit</span>
              </div>
              <a
                href="#features"
                className="inline-flex items-center justify-center min-h-[48px] px-6 text-primary font-semibold hover:underline underline-offset-4"
              >
                Voir comment ça marche
              </a>
            </div>
          </FadeIn>

          <HeroScreenshot
            screenshotSrc="/screenshots/webapp/dashboard.png"
            screenshotLabel="Dashboard Pulpe - Vue du mois en cours"
          />
        </div>
      </div>
    </section>
  )
}
