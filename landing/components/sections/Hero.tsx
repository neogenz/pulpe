import {
  Button,
  FadeIn,
  FloatingCard,
  GrainOverlay,
  HeroScreenshot,
  TypeWriter,
} from "@/components/ui";
import { ANGULAR_APP_URL } from "@/lib/config";
import {
  Check,
  Gamepad2,
  PiggyBank,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

const TYPEWRITER_STRINGS = [
  "Pulpe, oui.",
  "Ce mois, oui.",
  "Sur 12 mois, oui.",
  "Au centime près, oui.",
];

type FloatingCardVariant =
  | "pill"
  | "trend"
  | "highlight"
  | "large"
  | "notification";

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
    id: "courses",
    position: "top-8 right-[35%]",
    delay: "delay-100",
    variant: "pill",
    animationDelay: -0.5,
    content: (
      <>
        <ShoppingBag className="w-4 h-4 text-primary" />
        <span>Courses</span>
      </>
    ),
  },
  {
    id: "trend-up",
    position: "-top-2 right-[20%]",
    delay: "delay-200",
    variant: "trend",
    animationDelay: -1,
    content: (
      <>
        <TrendingUp className="w-3.5 h-3.5" />
        <span>+12%</span>
      </>
    ),
  },
  {
    id: "disponible",
    position: "top-4 -right-2",
    delay: "delay-300",
    variant: "highlight",
    animationDelay: -1.5,
    content: (
      <div className="flex items-center gap-3">
        <Wallet className="w-5 h-5" />
        <div>
          <div className="text-xs">Disponible ce mois</div>
          <div className="text-xl font-bold">847 CHF</div>
        </div>
      </div>
    ),
  },
  {
    id: "epargne-mois",
    position: "top-[30%] right-[38%]",
    delay: "delay-400",
    variant: "large",
    animationDelay: -2,
    content: (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <PiggyBank className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-xs text-text-secondary">Épargné ce mois</div>
          <div className="text-lg font-bold text-primary">+120 CHF</div>
        </div>
      </div>
    ),
  },
  {
    id: "loisirs",
    position: "top-[48%] right-[-5%]",
    delay: "delay-500",
    variant: "pill",
    animationDelay: -2.5,
    content: (
      <>
        <Gamepad2 className="w-4 h-4 text-primary" />
        <span>Loisirs</span>
      </>
    ),
  },
  {
    id: "epargne",
    position: "bottom-14 right-[38%]",
    delay: "delay-600",
    variant: "pill",
    animationDelay: -3,
    content: (
      <>
        <PiggyBank className="w-4 h-4 text-primary" />
        <span>Épargne</span>
      </>
    ),
  },
  {
    id: "a-jour",
    position: "bottom-0 right-[24%]",
    delay: "delay-700",
    variant: "trend",
    animationDelay: -3.5,
    content: (
      <>
        <Check className="w-3.5 h-3.5" />
        <span>À jour</span>
      </>
    ),
  },
  {
    id: "notification",
    position: "bottom-12 right-[-4%]",
    delay: "delay-800",
    variant: "notification",
    animationDelay: -4,
    content: (
      <>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="font-medium">Transaction ajoutée</div>
          <div className="text-xs text-text-secondary">Il y a 2 min</div>
        </div>
      </>
    ),
  },
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-32 pb-16 md:pt-32 md:pb-24 bg-gradient-to-b from-background via-background to-surface-alt overflow-hidden">
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
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
              Budget annuel en 3 minutes
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-text mb-6">
              Tu sais ce qu&apos;il te reste ?
              <br />
              {/* Static text on mobile, TypeWriter on desktop */}
              <span className="text-primary md:hidden">Pulpe, oui.</span>
              <span className="text-primary hidden md:block min-h-[7.5rem] lg:min-h-[9.375rem]">
                <TypeWriter strings={TYPEWRITER_STRINGS} />
              </span>
            </h1>
            <p className="text-lg md:text-xl text-text-secondary mb-8 max-w-lg mx-auto lg:mx-0">
              Pulpe planifie ton année pour que tu saches toujours ce que tu
              peux dépenser. Sans prise de tête.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-start items-center justify-center lg:justify-start">
              <div className="flex flex-col items-center gap-2">
                <Button href={`${ANGULAR_APP_URL}/signup`} glow>
                  Commencer
                </Button>
                <span className="text-xs italic text-text-secondary">
                  C&apos;est gratuit
                </span>
              </div>
              <Button href="#features" variant="ghost">
                Voir comment ça marche
              </Button>
            </div>
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
