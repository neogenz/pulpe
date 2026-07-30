import {
  Building2,
  CodeXml,
  ExternalLink,
  FileDown,
  ShieldCheck,
} from "lucide-react";
import { Section } from "@/components/ui";
import { ANGULAR_APP_URL, GITHUB_URL } from "@/lib/config";

const GUARANTEES = [
  {
    icon: ShieldCheck,
    title: "Montants chiffrés",
    text: "Tes montants financiers sont chiffrés avec AES-256-GCM avant d’être stockés.",
  },
  {
    icon: Building2,
    title: "Aucune banque connectée",
    text: "Pulpe ne te demande aucun accès bancaire. Tu gardes la main sur les données que tu ajoutes.",
  },
  {
    icon: CodeXml,
    title: "Code source public",
    text: "Le code de Pulpe est ouvert : son fonctionnement et ses protections peuvent être vérifiés.",
  },
  {
    icon: FileDown,
    title: "Budgets exportables",
    text: "Tu peux récupérer tes budgets en JSON ou en Excel depuis l’application web.",
  },
] as const;

export function WhyFree() {
  return (
    <Section id="why-free" className="privacy-section">
      <div className="mx-auto max-w-6xl">
        <div
          className="section-heading reveal-up mx-auto max-w-4xl text-center"
          data-reveal
        >
          <p className="mb-4 font-bold uppercase tracking-[0.18em] text-primary">
            Tes données, tes règles
          </p>
          <h2>Un budget clair n&apos;a pas besoin de fouiller tes comptes.</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary">
            Pulpe te donne de la visibilité sans connexion bancaire, avec des
            protections que tu peux vérifier.
          </p>
        </div>

        <dl className="mt-12 grid gap-4 min-[620px]:grid-cols-2 min-[941px]:grid-cols-4">
          {GUARANTEES.map((guarantee, index) => (
            <div
              key={guarantee.title}
              className={`privacy-card reveal-up reveal-delay-${index} rounded-[2rem] border border-text/8 bg-surface p-6 shadow-[var(--shadow-organic)]`}
              data-reveal
            >
              <dt>
                <span className="privacy-icon">
                  <guarantee.icon
                    className="size-6 text-primary"
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-8 block text-xl font-bold tracking-[-0.025em] text-text">
                  {guarantee.title}
                </span>
              </dt>
              <dd className="mt-3 leading-relaxed text-text-secondary">
                {guarantee.text}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
          <a
            href={`${ANGULAR_APP_URL}/legal/confidentialite`}
            className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline"
          >
            Lire la politique de confidentialité
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 font-bold text-primary underline-offset-4 hover:underline"
          >
            Voir le code source
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </Section>
  );
}
