import type { Metadata } from "next";
import { Header, Footer } from "@/components/sections";
import { BudgetCalculator } from "@/components/calculator/BudgetCalculator";
import { Container } from "@/components/ui";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { socialPreviewImage } from "@/lib/metadata";
import { CALCULATOR_ROUTE } from "@/lib/routes";
import Link from "next/link";

const PAGE_TITLE = "Calculateur de budget suisse";
const PAGE_DESCRIPTION =
  "Calcule ton disponible mensuel en francs : revenus, charges, épargne. Sans compte, sans banque, les montants restent sur ta machine.";

export async function generateMetadata(): Promise<Metadata> {
  const image = socialPreviewImage(DEFAULT_LOCALE);
  const imageAlt = (await getDictionary(DEFAULT_LOCALE)).site.socialImageAlt;
  return {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    alternates: { canonical: CALCULATOR_ROUTE },
    openGraph: {
      title: `${PAGE_TITLE} | Pulpe`,
      description: PAGE_DESCRIPTION,
      siteName: "Pulpe",
      type: "website",
      url: CALCULATOR_ROUTE,
      locale: "fr_CH",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: imageAlt,
          type: "image/png",
        },
      ],
    },
  };
}

export default async function CalculatorPage() {
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
      <main id="main-content" tabIndex={-1} className="pt-32 pb-16 md:pb-24">
        <Container>
          <div className="mx-auto max-w-5xl">
            <header className="max-w-3xl">
              <h1 className="text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-text sm:text-5xl">
                Calcule ton budget suisse
              </h1>
              <p className="pretty mt-4 text-lg leading-relaxed text-text-secondary">
                Revenus, charges, épargne : le disponible se met à jour à chaque
                saisie. C’est le même calcul que dans Pulpe, limité à un mois.
              </p>
            </header>

            <div className="mt-10">
              <BudgetCalculator />
            </div>

            <article className="guide-prose mt-16 max-w-3xl">
              <h2>Pourquoi un calculateur suisse ?</h2>
              <p>
                Un budget français oublie la{" "}
                <a
                  href="https://www.bag.admin.ch/fr/primes-et-couts-reponses-aux-questions-frequentes"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  prime maladie
                </a>
                , la redevance radio-TV, la provision d’impôts et le{" "}
                <a
                  href="https://www.ch.ch/fr/travail/prevoyance-vieillesse/prevoyance-privee-3eme-pilier/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  pilier 3a
                </a>
                . Ici, ces postes ont une ligne ou un bouton. Pour un jeune de
                19 à 25 ans, la prime moyenne 2026 est à 326.30 CHF (OFSP).
              </p>
              <p>
                Le calculateur reste volontairement statique : un mois, pas une
                année. Les impôts en juillet, les vacances en août, le 13e en
                décembre n’y figurent pas. C’est la limite, et c’est pour ça que
                Pulpe existe.
              </p>
              <h2>Trois situations fréquentes</h2>
              <ul>
                <li>
                  Premier salaire : pose le net, le loyer, la prime, 50 CHF
                  d’épargne. Regarde le disponible avant d’ajouter des
                  abonnements.
                </li>
                <li>
                  Apprentissage : le revenu est plus bas, la prime jeune aussi.
                  Garde une ligne d’épargne même petite.
                </li>
                <li>
                  Études : si tes parents paient le loyer, mets 0 à cette ligne.
                  Le disponible doit coller à ce que tu gères vraiment.
                </li>
              </ul>
              <p>
                Pour des exemples chiffrés, vois l’
                <Link href="/conseils-budget/budget-mensuel-suisse-exemple">
                  exemple de budget mensuel
                </Link>{" "}
                et{" "}
                <Link href="/conseils-budget/comment-faire-son-budget-en-suisse">
                  comment faire son budget en Suisse
                </Link>
                .
              </p>
            </article>
          </div>
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
