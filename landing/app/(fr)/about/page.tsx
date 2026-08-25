import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { Footer, Header } from "@/components/sections";
import { getDictionary } from "@/content/dictionary";
import { GITHUB_URL } from "@/lib/config";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { socialMetadata } from "@/lib/metadata";
import { ABOUT_ROUTE } from "@/lib/routes";

const title = "À propos de Pulpe";
const description =
  "Découvre pourquoi Maxime a créé Pulpe, comment le projet est financé aujourd’hui et ce que son code source public permet de vérifier.";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getDictionary(DEFAULT_LOCALE);
  return {
    title,
    description,
    alternates: { canonical: ABOUT_ROUTE },
    ...socialMetadata({
      locale: DEFAULT_LOCALE,
      path: ABOUT_ROUTE,
      title: `${title} | Pulpe`,
      description,
      imageAlt: site.socialImageAlt,
      type: "website",
    }),
  };
}

export default async function AboutPage() {
  const dict = await getDictionary(DEFAULT_LOCALE);
  const { whyFree } = dict.home;

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        {dict.common.skipToContent}
      </a>
      <Header dict={dict.header} locale={DEFAULT_LOCALE} />

      <main
        id="main-content"
        tabIndex={-1}
        className="pb-16 pt-[calc(9rem+env(safe-area-inset-top))] md:pb-24 md:pt-[calc(10rem+env(safe-area-inset-top))]"
      >
        <Container>
          <article className="mx-auto max-w-3xl">
            <header className="mb-14 md:mb-18">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                {whyFree.eyebrow}
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-text-secondary sm:text-xl">
                Pulpe est une application de budget créée depuis la Suisse par
                Maxime. Elle aide à préparer l’année et à voir ce qu’une
                décision change dans les mois suivants, sans connecter de compte
                bancaire.
              </p>
            </header>

            <div className="space-y-12 leading-relaxed text-text-secondary">
              <section aria-labelledby="origin-heading">
                <h2
                  id="origin-heading"
                  className="text-2xl font-bold tracking-[-0.025em] text-text sm:text-3xl"
                >
                  Pourquoi Pulpe existe
                </h2>
                {whyFree.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-4">
                    {paragraph}
                  </p>
                ))}
              </section>

              <section aria-labelledby="model-heading">
                <h2
                  id="model-heading"
                  className="text-2xl font-bold tracking-[-0.025em] text-text sm:text-3xl"
                >
                  Un projet personnel au code public
                </h2>
                <p className="mt-4">
                  Pulpe est aujourd’hui gratuit, sans publicité ni abonnement.
                  Le code source peut être consulté publiquement sur GitHub pour
                  examiner le fonctionnement du projet ou proposer une
                  amélioration. Les données personnelles des utilisateurs ne
                  font pas partie du dépôt public.
                </p>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-11 items-center rounded-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {whyFree.sourceLink}
                </a>
              </section>

              <section aria-labelledby="choices-heading">
                <h2
                  id="choices-heading"
                  className="text-2xl font-bold tracking-[-0.025em] text-text sm:text-3xl"
                >
                  Des choix adaptés à un petit projet
                </h2>
                <p className="mt-4">
                  La saisie bancaire reste manuelle. Une synchronisation fiable
                  en Suisse et en France demanderait des prestataires externes,
                  des coûts et des contraintes réglementaires que ce projet
                  développé seul ne peut pas porter aujourd’hui. Les montants
                  enregistrés sont chiffrés avec AES-256-GCM et ne sont pas
                  revendus.
                </p>
              </section>
            </div>
          </article>
        </Container>
      </main>

      <Footer
        dict={dict.footer}
        language={dict.language}
        locale={DEFAULT_LOCALE}
        route={null}
      />
    </>
  );
}
