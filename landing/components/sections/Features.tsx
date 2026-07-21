import { ShieldCheck, Sprout, Zap } from "lucide-react";
import { Screenshot, Section } from "@/components/ui";

export function Features() {
  return (
    <Section id="features" className="pt-10 lg:pt-16">
      <div className="max-w-3xl">
        <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          Pose ton budget une fois. Ajuste seulement ce qui change.
        </h2>
      </div>

      <article className="mt-14 grid items-center gap-9 overflow-hidden rounded-[var(--radius-large)] bg-surface-alt p-6 sm:p-9 lg:grid-cols-5 lg:gap-14 lg:p-12">
        <div className="lg:col-span-2">
          <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary">
            <Sprout className="size-4" aria-hidden="true" />
            Ton mois type
          </p>
          <h3 className="text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-4xl">
            Une base pour préparer les mois suivants.
          </h3>
          <p className="mt-5 text-lg leading-relaxed text-text-secondary">
            Renseigne un mois habituel une fois. Les prochains mois partent de
            cette base, et tu ajustes seulement ce qui change.
          </p>
        </div>
        <div className="lg:col-span-3">
          <Screenshot
            src="/screenshots/responsive/ecran-des-modeles.webp"
            desktopSrc="/screenshots/webapp/ecran-des-modeles.webp"
            label="Modèles de budget dans Pulpe"
            mobileWidth={750}
            mobileHeight={1190}
            desktopWidth={1261}
            desktopHeight={956}
          />
        </div>
      </article>

      <article className="mt-14 grid items-center gap-8 border-t border-text/10 pt-14 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Tes dépenses récurrentes
          </p>
          <h3 className="text-3xl font-semibold leading-tight tracking-[-0.025em]">
            Tes charges reviennent. Pas besoin de les ressaisir.
          </h3>
          <p className="mt-4 max-w-xl leading-relaxed text-text-secondary">
            Pulpe reprend les charges de ton mois type dans les mois à venir.
            Quand l&apos;une d&apos;elles évolue, tu modifies uniquement cette
            prévision.
          </p>
        </div>
        <div className="lg:col-span-7">
          <Screenshot
            src="/screenshots/responsive/liste-des-previsions.webp"
            desktopSrc="/screenshots/webapp/liste-des-previsions.webp"
            label="Prévisions mensuelles dans Pulpe"
            mobileWidth={750}
            mobileHeight={1212}
            desktopWidth={1500}
            desktopHeight={1235}
          />
        </div>
      </article>

      <article className="mt-14 grid items-center gap-8 border-t border-text/10 pt-14 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5 lg:col-start-8">
          <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary">
            <Zap className="size-4" aria-hidden="true" />
            Quand le réel change
          </p>
          <h3 className="text-3xl font-semibold leading-tight tracking-[-0.025em]">
            Le réel met ta projection à jour.
          </h3>
          <p className="mt-4 max-w-xl leading-relaxed text-text-secondary">
            Ajoute une dépense dans le bon mois et Pulpe recalcule la suite. Ta
            projection évolue sans te demander de refaire ton budget.
          </p>
        </div>
        <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1">
          <Screenshot
            src="/screenshots/responsive/modal-ajout-transaction.webp"
            desktopSrc="/screenshots/webapp/modal-ajout-transaction.webp"
            label="Ajout d’une dépense dans Pulpe"
            mobileWidth={750}
            mobileHeight={1190}
            desktopWidth={1260}
            desktopHeight={955}
          />
        </div>
      </article>
    </Section>
  );
}
