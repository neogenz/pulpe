"use client";

import { useEffect, useState } from "react";
import { Button, HeroDashboard } from "@/components/ui";
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

export function Hero() {
  const currency = useVisitorCurrency();
  const unit = currency === "CHF" ? "CHF" : "€";

  return (
    <section className="hero-mesh relative overflow-hidden pb-12 pt-36 md:pb-28 md:pt-40 lg:pb-20 lg:pt-44">
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="balance mx-auto max-w-5xl text-[clamp(2.75rem,5.6vw,5rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-text">
            Tu sais des mois à l&apos;avance{" "}
            <span className="text-primary">ce qu&apos;il te restera.</span>
          </h1>
          <p className="pretty mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-text-secondary md:text-xl">
            Tu renseignes tes revenus, tes dépenses et ce que tu veux épargner.
            Pulpe calcule ton disponible mois après mois, sans connecter tes
            comptes bancaires.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
            <Button
              href={angularUrl("/signup", "hero_commencer")}
              glow
              onClick={() => trackCTAClick("commencer", "hero", "/signup")}
            >
              Créer mon budget gratuitement
            </Button>
            <Button
              href="#how-it-works"
              variant="ghost"
              className="text-text hover:text-primary"
            >
              Voir les 3 étapes
            </Button>
          </div>
          <p className="mt-4 text-center text-sm text-text-secondary">
            Gratuit · Montants chiffrés · Aucune connexion bancaire
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-5xl md:mt-18 lg:mt-20">
          <HeroDashboard amount={926} unit={unit} />
        </div>
      </div>
    </section>
  );
}
