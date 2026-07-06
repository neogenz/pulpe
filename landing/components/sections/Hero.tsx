'use client'

import {
  Button,
  FadeIn,
  FloatingCard,
  type FloatingCardVariant,
  GrainOverlay,
  HeroDashboard,
  TypeWriter,
} from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";
import { CalendarCheck, PiggyBank } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

function useVisitorCurrency(): 'CHF' | 'EUR' {
  const [currency, setCurrency] = useState<'CHF' | 'EUR'>('CHF')
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const langs = (navigator.languages ?? [navigator.language]).join(',')
    const isSwiss = tz === 'Europe/Zurich' || /-CH\b/i.test(langs)
    const isFrench = tz === 'Europe/Paris' || /\bfr(-FR)?\b/i.test(langs)
    if (!isSwiss && isFrench) setCurrency('EUR')
  }, [])
  return currency
}

interface FloatingCardConfig {
  id: string;
  position: string;
  delay: string;
  variant: FloatingCardVariant;
  animationDelay: number;
  content: ReactNode;
}

const STATIC_FLOATING_CARDS: FloatingCardConfig[] = [
  {
    id: "impots-budgetes",
    position: "-top-5 -left-5",
    delay: "anim-delay-400",
    variant: "large",
    animationDelay: -2,
    content: (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <CalendarCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-xs text-text-secondary">Impôts de juillet</div>
          <div className="text-lg font-bold text-text tabular-nums">Budgétés</div>
        </div>
      </div>
    ),
  },
  {
    id: "epargne-maison",
    position: "-bottom-6 -right-5",
    delay: "anim-delay-600",
    variant: "notification",
    animationDelay: -3,
    content: (
      <>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <PiggyBank className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="font-medium">Épargne maison</div>
          <div className="text-xs text-text-secondary">68% de l&apos;objectif</div>
        </div>
      </>
    ),
  },
];

export function Hero() {
  const currency = useVisitorCurrency()
  const unit = currency === 'CHF' ? 'CHF' : '€'
  const amount = 926
  const suffix = `${amount} ${unit}`

  const typewriterStrings = useMemo(() => [
    `${suffix} disponibles ce mois.`,
    "Impôts de juillet ? Budgétés.",
    "Épargne maison : sur les rails.",
  ], [suffix])

  const floatingCards = STATIC_FLOATING_CARDS

  return (
    <section className="hero-mesh relative min-h-[100dvh] flex items-center pt-32 pb-16 md:pt-32 md:pb-24 bg-gradient-to-b from-background via-background to-surface-alt overflow-hidden">
      <GrainOverlay opacity={0.03} />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: text content */}
          <div className="text-center lg:text-left">
            <p className="text-[13px] font-semibold text-primary mb-4 tracking-[0.08em] uppercase">
              Ton budget annuel en 3 minutes
            </p>
            <h1 className="leading-[1.05] mb-4 balance">
              <span className="italic block text-2xl md:text-3xl lg:text-4xl font-normal text-text-secondary mb-1 tracking-normal">
                &laquo;&nbsp;Je peux me le permettre&nbsp;?&nbsp;&raquo;
              </span>
              <span className="block text-6xl md:text-7xl lg:text-[5.25rem] font-extrabold text-primary tracking-[-0.035em] leading-[0.92]">
                Tu sais d&apos;avance.
              </span>
            </h1>
            <div className="text-xl md:text-2xl lg:text-3xl font-normal text-text-secondary mb-8 tabular-nums">
              <span className="md:hidden">{suffix} disponibles ce mois.</span>
              <span className="hidden md:block min-h-[2.5rem] lg:min-h-[3rem]">
                <TypeWriter strings={typewriterStrings} />
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center items-center justify-center lg:justify-start">
              <Button href={angularUrl('/signup', 'hero_commencer')} glow onClick={() => trackCTAClick('commencer', 'hero', '/signup')}>
                Commencer
              </Button>
              <Button href="#how-it-works" variant="ghost" className="text-text hover:text-text">
                Voir comment ça marche
              </Button>
            </div>
            <p className="text-xs italic text-text-secondary mt-3 text-center lg:text-left">
              C&apos;est gratuit · Données privées · Sans connexion bancaire
            </p>
          </div>

          {/* Right: live dashboard with floating accent cards anchored to its edges */}
          <FadeIn animateOnMount delay={0.3}>
            <div className="relative">
              <HeroDashboard amount={amount} unit={unit} />
              {floatingCards.map((card) => (
                <div
                  key={card.id}
                  className={`absolute ${card.position} hidden lg:block z-20 animate-fade-in-float ${card.delay}`}
                >
                  <FloatingCard
                    variant={card.variant}
                    animationDelay={card.animationDelay}
                  >
                    {card.content}
                  </FloatingCard>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
