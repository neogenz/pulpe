import { Code2, ExternalLink, Server, ShieldCheck } from "lucide-react";
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
    icon: Code2,
    title: "Code ouvert",
    text: "Le code source est public : tu peux voir comment Pulpe fonctionne et comment tes montants sont protégés.",
  },
] as const;

export function WhyFree() {
  return (
    <Section id="why-free">
      <div className="grid gap-14 lg:grid-cols-5 lg:gap-20">
        <div className="lg:col-span-3">
          <p className="text-sm font-medium text-primary">
            Une note du créateur
          </p>
          <h2 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
            J&apos;avais besoin d&apos;un budget qui regarde devant.
          </h2>
          <div className="mt-7 max-w-2xl space-y-5 text-lg leading-relaxed text-text-secondary">
            <p>
              J&apos;ai créé Pulpe après trop de mois passés à bricoler des
              tableurs qui expliquaient le passé, sans m&apos;aider à anticiper
              la suite.
            </p>
            <p>
              Le projet est gratuit aujourd&apos;hui, sans publicité ni
              abonnement. Son code reste public pour que tu puisses vérifier
              son fonctionnement.
            </p>
          </div>
          <p className="mt-8 font-semibold text-text">
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

        <dl className="lg:col-span-2">
          {GUARANTEES.map((guarantee, index) => (
            <div
              key={guarantee.title}
              className={`py-7 ${index > 0 ? "border-t border-text/10" : ""}`}
            >
              <dt className="flex items-center gap-3 font-semibold text-text">
                <guarantee.icon
                  className="size-5 text-primary"
                  strokeWidth={1.7}
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
