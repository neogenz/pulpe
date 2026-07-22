import {
  ArrowRightLeft,
  CalendarRange,
  Flag,
  Tags,
  WalletCards,
} from "lucide-react";
import { Section } from "@/components/ui";

const MONTHS = ["Mai", "Juin", "Juil.", "Août"] as const;

const ADJUSTMENTS = [
  {
    icon: ArrowRightLeft,
    title: "Cet achat peut attendre.",
    text: "Déplace sa prévision au mois suivant sans la supprimer ni la recréer.",
  },
  {
    icon: Tags,
    title: "Tes dépenses restent faciles à retrouver.",
    text: "Ajoute un tag comme Vacances ou Maison, puis retrouve tout ce qui va ensemble.",
  },
  {
    icon: CalendarRange,
    title: "Chaque mois part du solde du précédent.",
    text: "Tu vois tout de suite l’effet d’un changement sur le reste de l’année.",
  },
] as const;

export function Features() {
  return (
    <Section id="features">
      <header className="max-w-4xl">
        <h2 className="balance text-[clamp(2rem,9vw,3rem)] font-bold leading-[1.08] tracking-[-0.035em] text-text sm:text-5xl lg:text-6xl">
          Quand tes plans changent,{" "}
          <mark className="marker-highlight marker-highlight-strong">
            Pulpe recalcule la suite.
          </mark>
        </h2>
      </header>

      <div className="mt-12 overflow-hidden rounded-[var(--radius-large)] bg-surface outline outline-1 -outline-offset-1 outline-black/5 lg:mt-14">
        <div className="grid md:grid-cols-[1.08fr_0.92fr]">
          <article className="bg-surface-alt p-6 sm:p-9 lg:p-10">
            <WalletCards
              className="size-6 text-primary"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <h3 className="balance mt-5 max-w-xl text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-3xl">
              Répartis une grosse dépense sur plusieurs mois.
            </h3>
            <p className="pretty mt-4 max-w-xl leading-relaxed text-text-secondary">
              <strong className="font-semibold text-text">
                Le total ne change pas.
              </strong>{" "}
              Tu choisis les mois, Pulpe calcule la part de chacun et te montre
              ce qu’il reste à mettre de côté.
            </p>

            <div
              className="mt-8 rounded-[var(--radius-card)] bg-surface p-5 outline outline-1 -outline-offset-1 outline-black/5 sm:p-6"
              aria-hidden="true"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium text-text-secondary">
                  Assurance annuelle
                </span>
                <strong className="tabular-nums text-lg font-semibold text-text">
                  1&apos;200 CHF
                </strong>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 min-[360px]:grid-cols-4 min-[360px]:gap-2 sm:gap-3">
                {MONTHS.map((month) => (
                  <div key={month} className="min-w-0">
                    <div className="h-2 rounded-full bg-primary/75" />
                    <p className="tabular-nums mt-2 truncate text-xs font-semibold text-text sm:text-sm">
                      300 CHF
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {month}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="p-6 sm:p-9 lg:p-10">
            <Flag
              className="size-6 text-primary"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <h3 className="balance mt-5 max-w-md text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-3xl">
              Suis ce que tu mets vraiment de côté.
            </h3>
            <p className="pretty mt-4 max-w-md leading-relaxed text-text-secondary">
              Fixe un montant et une date pour ton projet. Pulpe distingue ce
              que tu as prévu de ce que tu as déjà épargné.
            </p>

            <div
              className="mt-8 rounded-[var(--radius-card)] bg-surface-alt p-5 sm:p-6"
              aria-hidden="true"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-text">Vacances</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Objectif · septembre
                  </p>
                </div>
                <p className="tabular-nums shrink-0 text-right text-sm font-semibold text-text">
                  1&apos;560 / 2&apos;400 CHF
                </p>
              </div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-primary/12">
                <div className="h-full w-[65%] rounded-full bg-primary" />
              </div>
              <div className="mt-3 flex justify-between gap-4 text-sm">
                <span className="font-medium text-primary">65 % épargné</span>
                <span className="text-text-secondary">Reste 840 CHF</span>
              </div>
            </div>
          </article>
        </div>

        <ul className="grid gap-8 border-t border-text/10 p-6 sm:grid-cols-3 sm:p-9 lg:gap-10 lg:p-10">
          {ADJUSTMENTS.map((item) => (
            <li key={item.title}>
              <item.icon
                className="size-5 text-primary"
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <h3 className="balance mt-4 text-lg font-semibold leading-snug text-text">
                {item.title}
              </h3>
              <p className="pretty mt-2 text-sm leading-relaxed text-text-secondary sm:text-base">
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
