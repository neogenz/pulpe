'use client'

import {
  Button,
  FadeIn,
  FloatingCard,
  type FloatingCardVariant,
  GrainOverlay,
  HeroScreenshot,
  TypeWriter,
} from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";
import { CalendarCheck, PiggyBank, Wallet } from "lucide-react";
import type { ReactNode } from "react";

const TYPEWRITER_STRINGS = [
  "847 CHF disponibles ce mois.",
  "Impôts de juillet ? Budgétés.",
  "Épargne maison : sur les rails.",
];

interface FloatingCardConfig {
  id: string;
  position: string;
  delay: string;
  variant: FloatingCardVariant;
  animationDelay: number;
  content: ReactNode;
}

const FLOATING_CARDS: FloatingCardConfig[] = [
  {
    id: "disponible",
    position: "top-4 -right-2",
    delay: "delay-200",
    variant: "highlight",
    animationDelay: -1,
    content: (
      <div className="flex items-center gap-3">
        <Wallet className="w-5 h-5" />
        <div>
          <div className="text-xs">Disponible ce mois</div>
          <div className="text-xl font-bold tabular-nums">847 CHF</div>
        </div>
      </div>
    ),
  },
  {
    id: "impots-budgetes",
    position: "top-[30%] right-[38%]",
    delay: "delay-400",
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
    position: "bottom-12 right-[-4%]",
    delay: "delay-600",
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
  return (
    <section className="hero-mesh relative min-h-[100dvh] flex items-center pt-32 pb-16 md:pt-32 md:pb-24 bg-gradient-to-b from-background via-background to-surface-alt overflow-hidden">
      <GrainOverlay opacity={0.03} />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Floating cards — desktop only */}
        {FLOATING_CARDS.map((card) => (
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

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: text content */}
          <div className="text-center lg:text-left">
            <p className="text-xs font-medium text-primary mb-4 tracking-[0.14em] uppercase">
              Ton budget annuel en 3 minutes
            </p>
            <h1 className="leading-[1.05] mb-4 balance">
              <span className="italic block text-2xl md:text-3xl lg:text-4xl font-normal text-text-secondary mb-1 tracking-normal">
                &laquo;&nbsp;Je peux me le permettre&nbsp;?&nbsp;&raquo;
              </span>
              <span className="block text-5xl md:text-6xl lg:text-[4.25rem] font-bold text-primary tracking-[-0.02em]">
                Tu sais d&apos;avance.
              </span>
            </h1>
            <div className="text-xl md:text-2xl lg:text-3xl font-normal text-text-secondary mb-8 tabular-nums">
              <span className="md:hidden">847 CHF disponibles ce mois.</span>
              <span className="hidden md:block min-h-[2.5rem] lg:min-h-[3rem]">
                <TypeWriter strings={TYPEWRITER_STRINGS} />
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center items-center justify-center lg:justify-start">
              <Button href={angularUrl('/signup', 'hero_commencer')} glow onClick={() => trackCTAClick('commencer', 'hero', '/signup')}>
                Commencer
              </Button>
              <Button href="#features" variant="ghost" className="text-text hover:text-text">
                Voir comment ça marche
              </Button>
            </div>
            <p className="text-xs italic text-text-secondary mt-3 text-center lg:text-left">
              C&apos;est gratuit · Données privées · Sans connexion bancaire
            </p>
          </div>

          {/* Right: screenshot with floating cards around it */}
          <FadeIn animateOnMount delay={0.3}>
            <HeroScreenshot
              screenshotSrc="/screenshots/responsive/dashboard.webp"
              screenshotDesktopSrc="/screenshots/webapp/dashboard.webp"
              screenshotLabel="Dashboard Pulpe - Vue du mois en cours"
            />
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
