"use client";

import { useSyncExternalStore } from "react";
import { Button, HeroDashboard } from "@/components/ui";
import { angularUrl } from "@/lib/config";
import { trackCTAClick } from "@/lib/posthog";

function subscribeToNothing() {
  return () => undefined;
}

function getVisitorCurrency(): "CHF" | "EUR" {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const languages = (navigator.languages ?? [navigator.language]).join(",");
  const isSwiss = timezone === "Europe/Zurich" || /-CH\b/i.test(languages);
  const isFrench =
    timezone === "Europe/Paris" || /\bfr(-FR)?\b/i.test(languages);
  return !isSwiss && isFrench ? "EUR" : "CHF";
}

function useVisitorCurrency(): "CHF" | "EUR" {
  return useSyncExternalStore(
    subscribeToNothing,
    getVisitorCurrency,
    () => "CHF" as const,
  );
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
            <mark className="marker-highlight marker-highlight-strong">
              combien il te restera.
            </mark>
          </h1>
          <p className="pretty mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-text-secondary md:text-xl">
            Planifie ton budget{" "}
            <strong className="font-semibold text-text">
              sur l&apos;année
            </strong>
            . Tu vois combien il te restera chaque mois pour préparer tes
            projets plus sereinement.
          </p>
          <div className="mt-9 flex justify-center">
            <Button
              href={angularUrl("/signup", "hero_commencer")}
              glow
              onClick={() => trackCTAClick("commencer", "hero", "/signup")}
            >
              Créer mon budget gratuitement
            </Button>
          </div>
          <p className="mt-4 text-center text-sm text-text-secondary">
            Gratuit · Montants chiffrés · Aucune connexion bancaire
          </p>
          {/* Desktop has room for the proof quote; mobile keeps the hero lean
              and meets the same words in Testimonials. */}
          <blockquote className="mx-auto mt-6 hidden max-w-2xl text-center md:block">
            <p className="pretty text-base font-medium leading-relaxed text-text">
              « Je peux{" "}
              <mark className="marker-highlight marker-highlight-proof">
                <strong className="font-semibold">
                  prévoir nos vacances sur l&apos;année
                </strong>
              </mark>{" "}
              et voir tout de suite si ça rentre dans notre budget. Ça me
              rassure. »
            </p>
            <footer className="mt-1 text-sm text-text-secondary">
              <cite className="not-italic">Sylvie, utilisatrice de Pulpe</cite>
            </footer>
          </blockquote>
        </div>

        <div className="mx-auto mt-14 max-w-5xl md:mt-18 lg:mt-20">
          <HeroDashboard amount={926} unit={unit} />
        </div>
      </div>
    </section>
  );
}
