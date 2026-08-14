import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui";
import { Footer, Header } from "@/components/sections";
import { GUIDES } from "@/components/guides/guides";
import { SOCIAL_PREVIEW_ALT, SOCIAL_PREVIEW_IMAGE } from "@/lib/config";

const PAGE_TITLE = "Conseils budget";
const PAGE_DESCRIPTION =
  "Des conseils concrets pour gérer ton budget en Suisse : méthode, chiffres et exemples pour savoir combien il te restera chaque mois.";
const SOCIAL_TITLE = `${PAGE_TITLE} | Pulpe`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/conseils-budget",
  },
  openGraph: {
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: "Pulpe",
    type: "website",
    url: "/conseils-budget",
    locale: "fr_CH",
    alternateLocale: ["fr_FR"],
    images: [
      {
        url: SOCIAL_PREVIEW_IMAGE,
        width: 1200,
        height: 630,
        alt: SOCIAL_PREVIEW_ALT,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: SOCIAL_PREVIEW_IMAGE,
        alt: SOCIAL_PREVIEW_ALT,
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function GuidesPage() {
  const guides = [...GUIDES].sort((first, second) =>
    second.publishedAt.localeCompare(first.publishedAt),
  );

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        Aller au contenu
      </a>

      <Header />

      <main id="main-content" tabIndex={-1} className="pt-32 pb-16 md:pb-24">
        <Container>
          <div className="mx-auto max-w-3xl">
            <header>
              <h1 className="text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-text sm:text-5xl">
                Conseils budget
              </h1>
              <p className="pretty mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">
                Des méthodes concrètes pour gérer ton budget en Suisse et savoir
                combien il te restera chaque mois.
              </p>
            </header>

            <div className="mt-10 space-y-4">
              {guides.map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/conseils-budget/${guide.slug}`}
                  className="block rounded-[var(--radius-large)] border border-text/10 bg-surface p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none motion-reduce:transition-none sm:p-8"
                >
                  <h2 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-text">
                    {guide.title}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-text-secondary">
                    {guide.description}
                  </p>
                  <p className="mt-4 text-sm text-text-secondary">
                    {guide.readingMinutes} min de lecture
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </>
  );
}
