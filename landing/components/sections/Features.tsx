import { ShieldCheck, Sprout, Zap } from "lucide-react";
import { Badge, Screenshot, Section } from "@/components/ui";

export function Features() {
  return (
    <Section id="features" className="pt-10 lg:pt-16">
      <div className="max-w-3xl">
        <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          Moins de saisie. Des décisions plus sereines.
        </h2>
      </div>

      <article className="mt-14 grid items-center gap-9 overflow-hidden rounded-[var(--radius-large)] bg-surface-alt p-6 sm:p-9 lg:grid-cols-5 lg:gap-14 lg:p-12">
        <div className="lg:col-span-2">
          <Badge className="mb-5">
            <ShieldCheck className="size-4" />
            Tes dépenses récurrentes
          </Badge>
          <h3 className="text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-4xl">
            Tes charges reviennent. Tu ne les ressaisis pas.
          </h3>
          <p className="mt-5 text-lg leading-relaxed text-text-secondary">
            Ajoute tes charges au mois type : Pulpe les reprend chaque mois. Tu
            n&apos;as plus qu&apos;à pointer ce qui est passé pour garder ton
            disponible à jour.
          </p>
        </div>
        <div className="lg:col-span-3">
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

      <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-10">
        <article className="lg:col-span-7 lg:pr-8">
          <Badge className="mb-5">
            <Sprout className="size-4" />
            Ton mois type
          </Badge>
          <h3 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.025em]">
            Une base pour préparer les mois suivants.
          </h3>
          <p className="mt-4 max-w-xl leading-relaxed text-text-secondary">
            Modifie un revenu ou une charge dans ton modèle. Les prochains mois
            partent de cette base, sans copier-coller.
          </p>
          <div className="mt-7">
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

        <article className="rounded-[var(--radius-large)] bg-surface p-6 shadow-[var(--shadow-organic)] outline outline-1 -outline-offset-1 outline-black/5 sm:p-8 lg:col-span-5">
          <Badge className="mb-5">
            <Zap className="size-4" />
            Tes dépenses réelles
          </Badge>
          <h3 className="text-3xl font-semibold leading-tight tracking-[-0.025em]">
            Ajoute une dépense sans refaire ton budget.
          </h3>
          <p className="mt-4 leading-relaxed text-text-secondary">
            Saisis le montant dans le bon mois. Si tu l&apos;avais prévue,
            associe-la à la prévision correspondante. Pulpe recalcule aussitôt
            ton disponible.
          </p>
          <div className="mt-7">
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
      </div>
    </Section>
  );
}
