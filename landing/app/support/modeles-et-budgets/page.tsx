import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/ui";
import { Footer, Header } from "@/components/sections";
import { CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Modèle ou budget : que faut-il modifier ?",
  description:
    "Comprendre la différence entre un modèle et un budget mensuel dans Pulpe, puis savoir lequel modifier sur iPhone.",
  alternates: {
    canonical: "/support/modeles-et-budgets",
  },
};

const choices = [
  {
    intent: "Changer uniquement ce mois-ci",
    destination: "Le budget du mois",
  },
  {
    intent: "Changer mes mois habituels",
    destination: "Le modèle",
  },
  {
    intent: "Créer le prochain mois",
    destination: "Un nouveau budget",
  },
  {
    intent: "Créer une autre base réutilisable",
    destination: "Un nouveau modèle",
  },
] as const;

const budgetSteps = [
  "Ouvre l’onglet « Budgets ».",
  "Touche + pour créer le budget du prochain mois, ou ouvre un mois existant.",
  "Dans le budget, touche + pour ajouter une prévision.",
  "Touche une prévision existante pour la modifier ou la supprimer.",
] as const;

const modelSteps = [
  "Ouvre l’onglet « Modèles ».",
  "Touche + pour créer une nouvelle base, ou ouvre un modèle existant.",
  "Touche une prévision existante pour la modifier.",
  "Choisis « Appliquer » pour reporter la modification sur les budgets en cours et futurs.",
] as const;

function Steps({ items }: { items: readonly string[] }) {
  return (
    <ol className="mt-7 space-y-5">
      {items.map((item, index) => (
        <li key={item} className="flex gap-4">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            {index + 1}
          </span>
          <p className="pt-0.5 leading-relaxed text-text-secondary">{item}</p>
        </li>
      ))}
    </ol>
  );
}

export default function ModelsAndBudgetsGuidePage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        Aller au contenu
      </a>

      <Header />

      <main id="main-content" tabIndex={-1}>
        <section className="hero-mesh relative overflow-hidden pb-10 pt-[calc(8.5rem+env(safe-area-inset-top))] md:pb-16 md:pt-[calc(10rem+env(safe-area-inset-top))]">
          <Container>
            <div className="mx-auto max-w-4xl">
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary transition-colors hover:text-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft aria-hidden="true" size={17} />
                Aide
              </Link>
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Modèles et budgets
              </p>
              <h1 className="balance mt-4 max-w-4xl text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl lg:text-6xl">
                Modèle ou budget&nbsp;: que faut-il modifier&nbsp;?
              </h1>
              <p className="pretty mt-6 max-w-3xl text-lg leading-relaxed text-text-secondary sm:text-xl">
                Le modèle prépare tes mois habituels. Un budget représente un
                mois précis.
              </p>
            </div>
          </Container>
        </section>

        <Section aria-labelledby="difference-heading">
          <div className="mx-auto max-w-4xl">
            <h2
              id="difference-heading"
              className="max-w-3xl text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
            >
              La différence en une phrase.
            </h2>

            <div className="mt-10 grid overflow-hidden rounded-[var(--radius-large)] border border-text/10 bg-surface md:grid-cols-2">
              <article className="p-6 sm:p-8 md:border-r md:border-text/10">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                  Le modèle
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-text">
                  Ta base de départ
                </h3>
                <p className="mt-4 leading-relaxed text-text-secondary">
                  Il contient tes revenus, dépenses et épargnes habituels. Il
                  sert à préparer tes budgets mensuels sans tout ressaisir.
                </p>
              </article>

              <article className="border-t border-text/10 p-6 sm:p-8 md:border-t-0">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                  Le budget
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-text">
                  Un mois précis
                </h3>
                <p className="mt-4 leading-relaxed text-text-secondary">
                  Il correspond par exemple à août 2026. Tu peux l’ajuster pour
                  ce mois sans changer ta base habituelle.
                </p>
              </article>
            </div>
          </div>
        </Section>

        <Section aria-labelledby="choice-heading">
          <div className="mx-auto max-w-4xl">
            <h2
              id="choice-heading"
              className="max-w-3xl text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
            >
              Choisis selon ce que tu veux changer.
            </h2>

            <dl className="mt-10 divide-y divide-text/10 border-y border-text/10">
              {choices.map((choice) => (
                <div
                  key={choice.intent}
                  className="grid gap-2 py-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6"
                >
                  <dt className="font-medium text-text">{choice.intent}</dt>
                  <ArrowRight
                    aria-hidden="true"
                    className="hidden text-primary sm:block"
                    size={18}
                  />
                  <dd className="font-semibold text-primary sm:text-right">
                    {choice.destination}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>

        <Section aria-labelledby="iphone-heading">
          <div className="mx-auto max-w-4xl">
            <header className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Sur iPhone
              </p>
              <h2
                id="iphone-heading"
                className="mt-3 text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
              >
                Les deux parcours, étape par étape.
              </h2>
            </header>

            <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
              <article>
                <p className="text-sm font-semibold text-accent">
                  Un seul mois
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-text">
                  Modifier un budget mensuel
                </h3>
                <Steps items={budgetSteps} />
              </article>

              <article className="border-t border-text/10 pt-10 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
                <p className="text-sm font-semibold text-primary">
                  Tes mois habituels
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-text">
                  Modifier le modèle
                </h3>
                <Steps items={modelSteps} />
              </article>
            </div>

            <aside className="mt-12 rounded-[var(--radius-large)] border border-primary/15 bg-primary/6 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-text">
                Tes ajustements restent protégés
              </h3>
              <p className="mt-3 leading-relaxed text-text-secondary">
                Quand tu choisis « Appliquer », Pulpe met à jour les budgets en
                cours et futurs. Une prévision déjà modifiée manuellement dans
                un budget n’est pas remplacée.
              </p>
              <p className="mt-4 leading-relaxed text-text-secondary">
                Sur iPhone, tu peux créer un modèle et modifier ses prévisions.
                Pour ajouter ou supprimer une prévision dans un modèle déjà
                créé, utilise actuellement la version web.
              </p>
            </aside>
          </div>
        </Section>

        <Section aria-labelledby="contact-heading">
          <div className="mx-auto max-w-4xl border-t border-text/10 pt-10">
            <h2
              id="contact-heading"
              className="text-3xl font-bold leading-tight tracking-[-0.025em] text-text"
            >
              Toujours bloqué&nbsp;?
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-text-secondary">
              Écris-moi en précisant l’écran où tu te trouves. Je te répondrai
              directement.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-primary transition-colors hover:text-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {CONTACT_EMAIL}
              <ArrowRight aria-hidden="true" size={17} />
            </a>
          </div>
        </Section>
      </main>

      <Footer />
    </>
  );
}
