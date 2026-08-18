import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccordionItem, Button, Container } from "@/components/ui";
import { Footer, Header } from "@/components/sections";
import type { Dictionary } from "@/content/dictionary";
import { angularUrl, ORGANIZATION_ID } from "@/lib/config";
import { socialPreviewImage } from "@/lib/metadata";
import { localizedPath, SITE_URL } from "@/lib/routes";
import { FR_GUIDE_CHROME, type GuideChrome } from "./chrome";
import type { Guide } from "./guides";

interface FaqEntry {
  question: string;
  // A string rather than ReactNode feeds both the visible FAQ and FAQPage
  // JSON-LD, preventing schema/page drift.
  answer: string;
}

interface ArticleLayoutProps {
  guide: Guide;
  faq?: FaqEntry[];
  /** L'article est français, mais son chrome se lit dans le catalogue comme partout ailleurs. */
  dict: Dictionary;
  children: ReactNode;
  chrome?: GuideChrome;
}

function formatDate(iso: string, dateLocale: string): string {
  return new Date(iso).toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    // A bare ISO date parses as UTC. Formatting in UTC avoids a one-day shift
    // on build machines west of Greenwich.
    timeZone: "UTC",
  });
}

export function ArticleLayout({
  guide,
  faq,
  dict,
  children,
  chrome = FR_GUIDE_CHROME,
}: ArticleLayoutProps) {
  const articleUrl = `${SITE_URL}${localizedPath(chrome.locale, `${chrome.sectionPath}/${guide.slug}`)}`;
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
        image: `${SITE_URL}${socialPreviewImage(chrome.locale)}`,
        inLanguage: chrome.inLanguage,
        datePublished: guide.publishedAt,
        dateModified: guide.updatedAt,
        author: { "@type": "Person", name: "Maxime De Sogus" },
        // The complete entity lives in the root layout @graph. Repeat its type
        // and name for validators that read this block in isolation.
        publisher: {
          "@type": "Organization",
          "@id": ORGANIZATION_ID,
          name: "Pulpe",
        },
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
        {dict.common.skipToContent}
      </a>

      <Header dict={dict.header} locale={chrome.locale} />

      <main id="main-content" tabIndex={-1} className="pt-32 pb-16 md:pb-24">
        <Container>
          <article className="mx-auto max-w-3xl">
            <Link
              href={chrome.backHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary hover:underline hover:decoration-2 hover:underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft aria-hidden="true" size={17} />
              {chrome.backLabel}
            </Link>
            <header className="mt-8">
              <h1 className="text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-text sm:text-5xl">
                {guide.title}
              </h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
                <time dateTime={guide.publishedAt}>
                  {chrome.publishedPrefix}{" "}
                  {formatDate(guide.publishedAt, chrome.dateLocale)}
                </time>
                {guide.updatedAt !== guide.publishedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <time dateTime={guide.updatedAt}>
                      {chrome.updatedPrefix}{" "}
                      {formatDate(guide.updatedAt, chrome.dateLocale)}
                    </time>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{chrome.readingTime(guide.readingMinutes)}</span>
              </p>
            </header>

            <div className="guide-prose mt-10">{children}</div>

            {faq && faq.length > 0 && (
              <section aria-labelledby="guide-faq-heading" className="mt-14">
                <h2
                  id="guide-faq-heading"
                  className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-text"
                >
                  {chrome.faqHeading}
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
                {chrome.ctaLead}
              </p>
              <Button
                href={angularUrl(
                  "/signup",
                  `guide_${guide.slug}`,
                  chrome.locale,
                )}
                className="mt-6"
                data-cta-name="commencer_gratuitement"
                data-cta-location="guide_article"
                data-cta-destination="/signup"
              >
                {chrome.ctaButton}
              </Button>
            </div>
          </article>
        </Container>
      </main>

      <Footer
        dict={dict.footer}
        language={dict.language}
        locale={chrome.locale}
        route={null}
      />
    </>
  );
}
