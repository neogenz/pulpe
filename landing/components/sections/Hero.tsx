"use client";

import { CalendarCheck, PiggyBank } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  FloatingCard,
  HeroDashboard,
  type FloatingCardVariant,
} from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";

function useVisitorCurrency(): "CHF" | "EUR" {
  const [currency, setCurrency] = useState<"CHF" | "EUR">("CHF");

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const languages = (navigator.languages ?? [navigator.language]).join(",");
    const isSwiss = timezone === "Europe/Zurich" || /-CH\b/i.test(languages);
    const isFrench =
      timezone === "Europe/Paris" || /\bfr(-FR)?\b/i.test(languages);
    if (!isSwiss && isFrench) setCurrency("EUR");
  }, []);

  return currency;
}

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
    id: "impots-budgetes",
    position: "left-[-3.5rem] top-24",
    delay: "anim-delay-400",
    variant: "large",
    animationDelay: -2,
    content: (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <CalendarCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-xs text-text-secondary">Impôts de juillet</div>
          <div className="text-lg font-bold text-text tabular-nums">
            Budgétés
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "epargne-maison",
    position: "bottom-16 right-[-3rem]",
    delay: "anim-delay-600",
    variant: "notification",
    animationDelay: -3,
    content: (
      <>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <PiggyBank className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="font-medium">Épargne maison</div>
          <div className="text-xs text-text-secondary">
            68% de l&apos;objectif
          </div>
        </div>
      </>
    ),
  },
];

export function Hero() {
  const currency = useVisitorCurrency();
  const unit = currency === "CHF" ? "CHF" : "€";

  return (
    <section className="hero-mesh relative overflow-hidden pb-12 pt-36 md:pb-28 md:pt-40 lg:pb-20 lg:pt-44">
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-6 inline-flex items-center rounded-full border border-primary/12 bg-primary/8 px-4 py-2 text-sm font-semibold text-primary">
            Planifie 12 mois en 3 minutes
          </p>
          <h1 className="balance mx-auto max-w-5xl text-[clamp(2.75rem,6.6vw,5.75rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-text">
            Tu sais des mois à l&apos;avance{" "}
            <span className="text-primary">ce qu&apos;il te restera.</span>
          </h1>
          <p className="pretty mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-text-secondary md:text-xl">
            Impôts, vacances, imprévus : Pulpe place toute ton année devant toi
            et projette ton solde mois après mois. Tu vois venir, sans relier ta
            banque.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
            <Button
              href={angularUrl("/signup", "hero_commencer")}
              glow
              onClick={() => trackCTAClick("commencer", "hero", "/signup")}
            >
              Commencer gratuitement
            </Button>
            <Button
              href="#how-it-works"
              variant="ghost"
              className="text-text hover:text-primary"
            >
              Voir comment ça marche
            </Button>
          </div>
          <p className="mt-4 text-center text-xs text-text-secondary">
            Gratuit · Données privées · Sans connexion bancaire
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl md:mt-18 lg:mt-20">
          <HeroDashboard amount={926} unit={unit} />
          {FLOATING_CARDS.map((card) => (
            <div
              key={card.id}
              className={`absolute z-20 hidden xl:block ${card.position} ${card.delay} animate-fade-in-float`}
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
      </div>
    </section>
  );
}
