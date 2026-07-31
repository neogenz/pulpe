"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { memo, useEffect, useId, useState } from "react";
import { currencyUnit, formatAmount, formatMoney } from "@/lib/amount";
import {
  HERO_AVAILABLE,
  HERO_BUDGET,
  HERO_PREVISIONS,
  HERO_SPENT,
  HERO_SPENT_PERCENT,
} from "@/lib/heroMock";
import { useVisitorCurrency } from "@/lib/visitorCurrency";

const CURVE = "M0,27 C14,25 22,29 34,25 C46,21 54,16 66,17 C78,18 86,9 100,8";

export const HeroDashboard = memo(function HeroDashboard() {
  const currency = useVisitorCurrency();
  const unit = currencyUnit(currency);
  const gradientId = useId();
  const [monthLabel, setMonthLabel] = useState("");
  const [live, setLive] = useState(false);
  const [ticked, setTicked] = useState(false);

  useEffect(() => {
    setMonthLabel(
      new Intl.DateTimeFormat("fr-CH", { month: "long" }).format(new Date()),
    );

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setLive(true);
      setTicked(true);
      return;
    }

    const frame = requestAnimationFrame(() => setLive(true));
    const timer = setTimeout(() => setTicked(true), 900);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  // A figure names itself through its caption. The aria-label this replaces sat
  // on a bare div, where ARIA forbids it. role="img" was the other route, but it
  // would hide the sr-only amount below, which is the one line worth reading.
  return (
    <figure className="overflow-hidden rounded-[var(--radius-large)] bg-surface shadow-[var(--shadow-screenshot)] outline outline-1 -outline-offset-1 outline-black/10">
      <figcaption className="sr-only">
        Aperçu du tableau de bord Pulpe
      </figcaption>
      <div className="flex items-center gap-2 border-b border-text/[0.06] px-4 py-3 md:px-5">
        <Image
          src="/icon-64.webp"
          alt=""
          aria-hidden="true"
          width={20}
          height={20}
          className="h-5 w-5"
          priority
        />
        <span className="text-sm font-semibold text-text">Tableau de bord</span>
        <span className="ml-auto text-xs font-medium text-text-secondary">
          Vue annuelle
        </span>
      </div>

      <div className="grid gap-3 bg-[#fbfdf9] p-3 md:grid-cols-[1.08fr_0.92fr] md:gap-4 md:p-5">
        {/* Every muted label on this panel is /90, not /80: the gradient starts
            at its lightest in the top-left corner, where /80 measured 4.72:1
            and the labels sitting there are 12px. Do not soften them back. */}
        <div className="flex min-h-[19rem] flex-col rounded-[14px] bg-gradient-to-br from-primary to-[#004d1a] p-6 text-white md:min-h-[22rem] md:p-8">
          <div className="mb-8 flex items-center gap-2 text-xs font-semibold text-white/90">
            <span
              className="h-1.5 w-1.5 rounded-full bg-white/80"
              aria-hidden="true"
            />
            Mois en cours{monthLabel ? ` · ${monthLabel}` : ""}
          </div>

          <p className="text-sm text-white/90">Disponible ce mois</p>
          <p className="mt-1 leading-none">
            <span className="sr-only">
              {HERO_AVAILABLE} {unit}
            </span>
            <span
              aria-hidden="true"
              className="text-[clamp(3.5rem,8vw,5.5rem)] font-extrabold tracking-[-0.04em] tabular-nums"
            >
              {formatAmount(HERO_AVAILABLE, currency)}
            </span>
            <span
              aria-hidden="true"
              className="ml-2 text-lg font-semibold text-white/90"
            >
              {unit}
            </span>
          </p>

          <div className="mt-auto pt-10">
            <div className="mb-2 flex justify-between text-xs text-white/90 tabular-nums">
              <span>Dépensé {formatMoney(HERO_SPENT, currency)}</span>
              <span>sur {formatMoney(HERO_BUDGET, currency)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white/90 transition-[width] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                style={{ width: live ? `${HERO_SPENT_PERCENT}%` : "0%" }}
                aria-hidden="true"
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/90">
              Tes grosses dépenses sont déjà intégrées aux mois qui arrivent.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-rows-[auto_1fr]">
          <div className="rounded-[14px] bg-[#f1f6ef] p-5 md:p-6">
            <p className="mb-4 text-xs font-semibold text-text-secondary">
              Prévisions du mois
            </p>
            <ul className="space-y-3">
              {HERO_PREVISIONS.map((prevision) => {
                const isChecked =
                  prevision.state === "checked" ||
                  (prevision.state === "ticks" && ticked);

                return (
                  <li
                    key={prevision.label}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span
                      className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border transition-colors duration-300 motion-reduce:transition-none ${
                        isChecked
                          ? "border-primary bg-primary"
                          : "border-text/25 bg-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      {isChecked && (
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      )}
                    </span>
                    <span
                      className={`flex-1 ${isChecked ? "text-text-secondary" : "text-text"}`}
                    >
                      {prevision.label}
                    </span>
                    <span className="text-text-secondary tabular-nums">
                      {formatMoney(prevision.amount, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col rounded-[14px] bg-[#f1f6ef] p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xs font-semibold text-text-secondary">
                Projection du solde
              </p>
              {/* Même graisse et même ton que le libellé de gauche : en
                  primary/semibold, aligné à droite d'un panneau, cette phrase
                  occupait la place d'un « Voir plus » et se lisait comme un
                  lien. C'est une légende, pas une action. */}
              <p className="text-xs font-semibold text-text-secondary">
                Tu vois venir
              </p>
            </div>
            {/* La viewBox déborde la courbe de 3 unités de chaque côté : tracée
                de x=0 à x=100 dans une boîte de même largeur, la série butait
                contre les deux bords et ses bouts arrondis étaient coupés net.
                La ligne de base est en non-scaling-stroke pour rester un filet
                d'1px malgré l'étirement vertical ; la courbe, elle, ne peut pas
                l'être : son animation de tracé repose sur `pathLength={1}` et
                `stroke-dasharray: 1`, et non-scaling-stroke change l'unité dans
                laquelle ce tiret est mesuré — le trait se casse en morceaux. */}
            <svg
              viewBox="-3 0 106 37"
              className="mt-auto h-24 w-full pt-5"
              preserveAspectRatio="none"
              role="img"
              aria-label="Projection du solde en hausse sur l'année"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-primary)"
                    stopOpacity="0.18"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-primary)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <line
                x1="-3"
                y1="36"
                x2="103"
                y2="36"
                stroke="var(--color-text)"
                strokeOpacity="0.12"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={`${CURVE} L100,36 L0,36 Z`}
                fill={`url(#${gradientId})`}
                className="hero-spark-area"
              />
              <path
                d={CURVE}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                className="hero-spark-line"
              />
            </svg>
          </div>
        </div>
      </div>
    </figure>
  );
});
