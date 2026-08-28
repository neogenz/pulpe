import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { Footer, Header } from "@/components/sections";
import { getDictionary } from "@/content/dictionary";
import { CONTACT_EMAIL } from "@/lib/config";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { socialMetadata } from "@/lib/metadata";
import { PRIVACY_ROUTE } from "@/lib/routes";

const title = "Confidentialité chez Pulpe";
const description =
  "Résumé lisible des données utilisées par Pulpe, de la protection des montants, des diagnostics et des droits des utilisateurs.";
const FULL_POLICY_URL = "https://app.pulpe.app/legal/confidentialite?lang=fr";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getDictionary(DEFAULT_LOCALE);
  return {
    title,
    description,
    alternates: { canonical: PRIVACY_ROUTE },
    ...socialMetadata({
      locale: DEFAULT_LOCALE,
      path: PRIVACY_ROUTE,
      title: `${title} | Pulpe`,
      description,
      imageAlt: site.socialImageAlt,
      type: "website",
    }),
  };
}

export default async function PrivacyPage() {
  const dict = await getDictionary(DEFAULT_LOCALE);

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
                Données et protection
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-text-secondary sm:text-xl">
                Cette page résume les pratiques actuelles de Pulpe. La politique
                de confidentialité complète reste le document de référence pour
                les bases légales, les durées de conservation et les détails de
                chaque traitement.
              </p>
            </header>

            <div className="space-y-12 leading-relaxed text-text-secondary">
              <section aria-labelledby="data-heading">
                <h2
                  id="data-heading"
                  className="text-2xl font-bold tracking-[-0.025em] text-text sm:text-3xl"
                >
                  Données nécessaires au service
                </h2>
                <p className="mt-4">
                  Pulpe utilise les informations du compte, les préférences et
                  les données budgétaires saisies pour sauvegarder et
                  synchroniser les budgets. Les montants financiers sont
                  chiffrés en base avec AES-256-GCM. Les connexions utilisent
                  HTTPS et l’accès aux données est limité à chaque utilisateur.
                  Pulpe ne vend pas les données personnelles.
                </p>
              </section>

              <section aria-labelledby="diagnostics-heading">
                <h2
                  id="diagnostics-heading"
                  className="text-2xl font-bold tracking-[-0.025em] text-text sm:text-3xl"
                >
                  Diagnostics contrôlables
                </h2>
                <p className="mt-4">
                  PostHog, hébergé en Europe, aide à comprendre les parcours et
                  les erreurs techniques. Les montants, mots de passe, clés de
                  récupération et libellés financiers en sont exclus. Le partage
                  des diagnostics peut être arrêté immédiatement dans les
                  préférences de chaque appareil ; ce choix coupe les nouvelles
                  captures et efface l’association locale à l’identité PostHog.
                  Le replay est désactivé en production.
                </p>
              </section>

              <section aria-labelledby="providers-heading">
                <h2
                  id="providers-heading"
                  className="text-2xl font-bold tracking-[-0.025em] text-text sm:text-3xl"
                >
                  Sous-traitants, droits et contact
                </h2>
                <p className="mt-4">
                  Le service s’appuie notamment sur Supabase pour le stockage et
                  l’authentification, Railway pour l’API, Vercel pour le site
                  web et PostHog pour les diagnostics. Selon ta situation, tu
                  peux demander l’accès, la rectification, l’effacement, la
                  portabilité ou exercer ton droit d’opposition. Pour toute
                  question ou demande, écris à{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="rounded-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
                <a
                  href={FULL_POLICY_URL}
                  className="mt-5 inline-flex min-h-11 items-center rounded-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Lire la politique de confidentialité complète
                </a>
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
