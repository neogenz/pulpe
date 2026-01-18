import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Gamepad2,
  PiggyBank,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Button,
  FadeIn,
  FloatingCard,
  GridBackground,
  HeroScreenshot,
  ShineBorder,
  TypeWriter,
} from "../ui";

const TYPEWRITER_STRINGS = [
  "Profite de ton mois.",
  "Anticipe tes dépenses.",
  "Épargne sans y penser.",
  "Reprends le contrôle.",
];

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  const floatingVariants = {
    hidden: shouldReduceMotion ? {} : { opacity: 0, scale: 0.8 },
    visible: (delay: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: shouldReduceMotion ? 0 : delay,
        ease: "easeOut",
      },
    }),
  };

  return (
    <section className="relative min-h-screen flex items-center pt-28 pb-16 md:pt-32 md:pb-24 bg-background overflow-hidden">
      {/* Subtle grid background */}
      <GridBackground />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Floating cards - organic gravitational arrangement around screenshot (right side only) */}

        {/* Top-left edge of screenshot zone */}
        <motion.div
          className="absolute top-8 right-[35%] hidden lg:block"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={0.2}
        >
          <FloatingCard variant="pill" rotation={-5} animationDelay={-0.5}>
            <ShoppingBag className="w-4 h-4 text-primary" />
            <span>Courses</span>
          </FloatingCard>
        </motion.div>

        {/* Top center-right, floating above */}
        <motion.div
          className="absolute -top-2 right-[20%] hidden lg:block"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={0.4}
        >
          <FloatingCard variant="trend" rotation={3} animationDelay={-1}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12%</span>
          </FloatingCard>
        </motion.div>

        {/* Top-right corner */}
        <motion.div
          className="absolute top-4 -right-2 hidden lg:block"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={0.6}
        >
          <FloatingCard variant="highlight" rotation={-2} animationDelay={-1.5}>
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5" />
              <div>
                <div className="text-xs opacity-80">Disponible ce mois</div>
                <div className="text-xl font-bold">847 CHF</div>
              </div>
            </div>
          </FloatingCard>
        </motion.div>

        {/* Left edge of screenshot, safe from text */}
        <motion.div
          className="absolute top-[30%] right-[38%] hidden lg:block"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={0.8}
        >
          <FloatingCard variant="large" rotation={-4} animationDelay={-2}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-text-secondary">
                  Épargné ce mois
                </div>
                <div className="text-lg font-bold text-primary">+120 CHF</div>
              </div>
            </div>
          </FloatingCard>
        </motion.div>

        {/* Right side, mid-height */}
        <motion.div
          className="absolute top-[48%] right-[-5%] hidden lg:block"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={1.0}
        >
          <FloatingCard variant="pill" rotation={5} animationDelay={-2.5}>
            <Gamepad2 className="w-4 h-4 text-primary" />
            <span>Loisirs</span>
          </FloatingCard>
        </motion.div>

        {/* Bottom-left of screenshot zone */}
        <motion.div
          className="absolute bottom-14 right-[38%] hidden lg:block"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={1.2}
        >
          <FloatingCard variant="pill" rotation={-3} animationDelay={-3}>
            <PiggyBank className="w-4 h-4 text-primary" />
            <span>Épargne</span>
          </FloatingCard>
        </motion.div>

        {/* Bottom center-right */}
        <motion.div
          className="absolute bottom-0 right-[24%] hidden lg:block"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={1.3}
        >
          <FloatingCard variant="trend" rotation={2} animationDelay={-3.5}>
            <Check className="w-3.5 h-3.5" />
            <span>À jour</span>
          </FloatingCard>
        </motion.div>

        {/* Bottom-right, drifting */}
        <motion.div
          className="absolute bottom-12 right-[-4%] hidden lg:block"
          variants={floatingVariants}
          initial="hidden"
          animate="visible"
          custom={1.4}
        >
          <FloatingCard
            variant="notification"
            rotation={-4}
            animationDelay={-4}
          >
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
          <FadeIn
            animateOnMount
            noYMovement
            className="text-center lg:text-left"
          >
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
            <p className="text-lg md:text-xl text-text-secondary mb-8 max-w-lg mx-auto lg:mx-0">
              Fini le stress des dépenses oubliées. Anticipe tout et note en 2
              clics.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start justify-center">
              <div className="flex flex-col items-center gap-3">
                <ShineBorder
                  color={["#006E25", "#2B883B", "#0061A6"]}
                  borderWidth={2}
                  duration={6}
                  className="bg-transparent"
                >
                  <Button>Commencer</Button>
                </ShineBorder>
                <span className="text-xs italic text-text-secondary">
                  C'est gratuit
                </span>
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
            screenshotSrc="/screenshots/responsive/dashboard.png"
            screenshotDesktopSrc="/screenshots/webapp/dashboard.png"
            screenshotLabel="Dashboard Pulpe - Vue du mois en cours"
          />
        </div>
      </div>
    </section>
  );
}
