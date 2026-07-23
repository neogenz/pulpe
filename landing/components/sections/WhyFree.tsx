import Image from "next/image";
import { CodeXml, ExternalLink, Server, ShieldCheck } from "lucide-react";
import { Section } from "@/components/ui";
import { GITHUB_URL } from "@/lib/config";

const GUARANTEES = [
  {
    icon: ShieldCheck,
    title: "Montants protégés",
    text: "Tes montants ne sont pas stockés en clair. Ils sont chiffrés avec AES-256-GCM à l’aide de deux clés conservées séparément.",
  },
  {
    icon: Server,
    title: "Mesure d’usage en Europe",
    text: "Les données d’usage qui servent à améliorer Pulpe sont traitées sur les serveurs européens de PostHog.",
  },
  {
    icon: CodeXml,
    title: "Code ouvert",
    text: "Le code source est public : tu peux voir comment Pulpe fonctionne et comment tes montants sont protégés.",
  },
] as const;

export function WhyFree() {
  return (
    <Section id="why-free">
      <div className="mx-auto max-w-5xl">
        <div className="grid items-start gap-7 sm:grid-cols-[9rem_minmax(0,1fr)] lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
          <Image
            src="/maxime-portrait.webp"
            alt="Maxime, créateur de Pulpe"
            width={640}
            height={800}
            className="aspect-square w-28 rounded-[var(--radius-large)] object-cover object-[50%_28%] shadow-[var(--shadow-organic)] sm:w-full"
          />

          <div>
            <p className="mb-3 font-semibold text-primary">
              Une note du créateur
            </p>
            <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
              J&apos;avais besoin d&apos;un budget qui regarde devant.
            </h2>
            <div className="mt-7 max-w-3xl space-y-5 text-lg leading-relaxed text-text-secondary">
              <p>
                J&apos;ai créé Pulpe après avoir passé trop de temps à tenir mes
                tableurs à jour. Je voulais savoir ce qu&apos;une décision
                changerait dans les mois suivants, pas seulement comprendre où
                mon argent était parti.
              </p>
              <p>
                Le projet est gratuit aujourd&apos;hui, sans publicité ni
                abonnement. Son code reste public pour que tu puisses vérifier
                son fonctionnement.
              </p>
            </div>
            <p className="mt-7 font-semibold text-text">
              Maxime, créateur de Pulpe
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Voir le code source
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <dl className="mt-12 grid border-t border-text/10 pt-2 md:grid-cols-3 lg:mt-16">
          {GUARANTEES.map((guarantee, index) => (
            <div
              key={guarantee.title}
              className={`py-7 md:px-7 ${
                index > 0
                  ? "border-t border-text/10 md:border-l md:border-t-0"
                  : "md:pl-0"
              } ${index === GUARANTEES.length - 1 ? "md:pr-0" : ""}`}
            >
              <dt className="flex items-center gap-3 font-semibold text-text">
                <guarantee.icon
                  className="size-5 text-primary"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                {guarantee.title}
              </dt>
              <dd className="mt-3 text-sm leading-relaxed text-text-secondary">
                {guarantee.text}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
