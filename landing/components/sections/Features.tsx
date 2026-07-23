import { ShieldCheck, Sprout, Zap } from "lucide-react";
import { Badge, Screenshot, Section } from "@/components/ui";

export function Features() {
  return (
    <Section id="features" className="pt-10 lg:pt-16">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Simple au quotidien</p>
        <h2 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          Moins de budget à gérer. Plus de décisions faciles.
        </h2>
      </div>

      <article className="mt-14 grid items-center gap-9 overflow-hidden rounded-[var(--radius-large)] bg-surface-alt p-6 sm:p-9 lg:grid-cols-5 lg:gap-14 lg:p-12">
        <div className="lg:col-span-2">
          <Badge className="mb-5">
            <ShieldCheck className="size-4" />
            Ton mois sous contrôle
          </Badge>
          <h3 className="text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-4xl">
            Tes charges reviennent. Pas ta saisie.
          </h3>
          <p className="mt-5 text-lg leading-relaxed text-text-secondary">
            Pulpe prépare tes dépenses récurrentes. Tu pointes ce qui est passé
            et ton disponible reste à jour, sans reconstruire le mois.
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
            Une fois, puis tout roule
          </Badge>
          <h3 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.025em]">
            Ton mois type devient les douze suivants.
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
            Quand le réel arrive
          </Badge>
          <h3 className="text-3xl font-semibold leading-tight tracking-[-0.025em]">
            Une dépense. Pas un formulaire interminable.
          </h3>
          <p className="mt-4 leading-relaxed text-text-secondary">
            Ajoute le montant au bon mois, rattache-le à ta prévision et
            continue. La projection intègre aussitôt ce qui a changé.
          </p>
          <div className="mt-7">
            <Screenshot
              src="/screenshots/responsive/modal-ajout-transaction.webp"
              desktopSrc="/screenshots/webapp/modal-ajout-transaction.webp"
              label="Ajout d’une transaction dans Pulpe"
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
