import type { ReactNode } from "react";
import { AccordionItem, Button, Container } from "@/components/ui";
import { Footer, Header } from "@/components/sections";
import { angularUrl, ORGANIZATION_ID, SITE_URL } from "@/lib/config";
import type { Guide } from "./guides";

interface FaqEntry {
  question: string;
  // Chaîne brute, pas de ReactNode : la même valeur alimente la FAQ visible et
  // le JSON-LD FAQPage, ce qui rend toute divergence schema/page impossible.
  answer: string;
}

interface ArticleLayoutProps {
  guide: Guide;
  faq?: FaqEntry[];
  children: ReactNode;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    // Une date ISO nue est parsée en UTC : formater en UTC aussi évite un
    // décalage d'un jour sur une machine de build à l'ouest de Greenwich.
    timeZone: "UTC",
  });
}

export function ArticleLayout({ guide, faq, children }: ArticleLayoutProps) {
  const articleUrl = `${SITE_URL}/guides/${guide.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${articleUrl}#article`,
        headline: guide.title,
        description: guide.description,
        url: articleUrl,
        mainEntityOfPage: articleUrl,
        inLanguage: "fr-CH",
        datePublished: guide.publishedAt,
        dateModified: guide.updatedAt,
        author: { "@type": "Person", name: "Maxime De Sogus" },
        // L'Organization est définie une seule fois, dans le @graph du layout
        // racine ; l'article la référence sans la dupliquer.
        publisher: { "@id": ORGANIZATION_ID },
      },
      ...(faq && faq.length > 0
        ? [
            {
              "@type": "FAQPage",
              "@id": `${articleUrl}#faq`,
              mainEntity: faq.map((entry) => ({
                "@type": "Question",
                name: entry.question,
                acceptedAnswer: { "@type": "Answer", text: entry.answer },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        Aller au contenu
      </a>

      <Header />

      <main id="main-content" tabIndex={-1} className="pt-32 pb-16 md:pb-24">
        <Container>
          <article className="mx-auto max-w-3xl">
            <header>
              <h1 className="text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-text sm:text-5xl">
                {guide.title}
              </h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
                <time dateTime={guide.publishedAt}>
                  Publié le {formatDate(guide.publishedAt)}
                </time>
                {guide.updatedAt !== guide.publishedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <time dateTime={guide.updatedAt}>
                      Mis à jour le {formatDate(guide.updatedAt)}
                    </time>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{guide.readingMinutes} min de lecture</span>
              </p>
            </header>

            <div className="guide-prose mt-10">{children}</div>

            {faq && faq.length > 0 && (
              <section aria-labelledby="guide-faq-heading" className="mt-14">
                <h2
                  id="guide-faq-heading"
                  className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-text"
                >
                  Questions fréquentes
                </h2>
                <div className="mt-6 space-y-3">
                  {faq.map((entry) => (
                    <AccordionItem
                      key={entry.question}
                      question={entry.question}
                      answer={entry.answer}
                    />
                  ))}
                </div>
              </section>
            )}

            <div className="mt-14 border-t border-text/10 pt-10 text-center">
              <p className="text-xl font-semibold leading-snug text-text">
                Envie de voir combien il te restera chaque mois&nbsp;?
              </p>
              <Button
                href={angularUrl("/signup", `guide_${guide.slug}`)}
                className="mt-6"
                data-cta-name="commencer_gratuitement"
                data-cta-location="guide_article"
                data-cta-destination="/signup"
              >
                Créer mon budget gratuitement
              </Button>
            </div>
          </article>
        </Container>
      </main>

      <Footer />
    </>
  );
}
