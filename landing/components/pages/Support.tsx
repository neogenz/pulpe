import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { LanguageBanner } from "@/components/LanguageBanner";
import { AccordionItem, Container, Section } from "@/components/ui";
import { FinalCTA, Footer, Header } from "@/components/sections";
import type { Dictionary } from "@/content/dictionary";
import { angularUrl, CONTACT_EMAIL, GITHUB_URL } from "@/lib/config";
import type { Locale } from "@/lib/i18n";
import { localizedPath } from "@/lib/routes";

const linkClass =
  "rounded-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

type SupportFaq = Dictionary["support"]["faq"];

interface FaqItem {
  question: string;
  answer: ReactNode;
  /** Le texte nu que reprend le JSON-LD, toujours dérivé de la réponse rendue. */
  plainAnswer: string;
}

/** Une réponse d'un seul tenant. */
function plainFaq(entry: { question: string; answer: string }): FaqItem {
  return {
    question: entry.question,
    answer: entry.answer,
    plainAnswer: entry.answer,
  };
}

/**
 * Une réponse qui porte un lien en ligne. Le texte nu se recompose des trois
 * morceaux plutôt que d'être écrit une seconde fois : la version rendue et
 * celle du JSON-LD ne peuvent plus diverger sans que personne ne le voie.
 */
function linkedFaq(
  entry: {
    question: string;
    answerBefore: string;
    answerLink: string;
    answerAfter: string;
  },
  link: { href: string; external?: boolean },
): FaqItem {
  return {
    question: entry.question,
    answer: (
      <>
        {entry.answerBefore}
        <a
          href={link.href}
          target={link.external ? "_blank" : undefined}
          rel={link.external ? "noopener noreferrer" : undefined}
          className={linkClass}
        >
          {entry.answerLink}
        </a>
        {entry.answerAfter}
      </>
    ),
    plainAnswer: `${entry.answerBefore}${entry.answerLink}${entry.answerAfter}`,
  };
}

// L'ordre d'affichage vit ici, avec la destination de chaque lien ; seul le
// texte vient du catalogue.
function buildFaqs(faq: SupportFaq, locale: Locale): FaqItem[] {
  return [
    plainFaq(faq.purpose),
    plainFaq(faq.excel),
    plainFaq(faq.bank),
    linkedFaq(faq.trust, { href: GITHUB_URL, external: true }),
    linkedFaq(faq.demo, {
      href: angularUrl("/welcome", "faq_demo", locale),
    }),
    linkedFaq(faq.free, { href: GITHUB_URL, external: true }),
    plainFaq(faq.countries),
    plainFaq(faq.sync),
    linkedFaq(faq.deletion, {
      href: angularUrl("/settings", "faq_delete_account", locale),
    }),
  ];
}

export function Support({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const { support } = dict;
  const faqs = buildFaqs(support.faq, locale);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.plainAnswer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <LanguageBanner locale={locale} route="/support" />

      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        {dict.common.skipToContent}
      </a>

      <Header dict={dict.header} locale={locale} />

      <main id="main-content" tabIndex={-1}>
        <section className="hero-mesh relative overflow-hidden pb-10 pt-[calc(9rem+env(safe-area-inset-top))] md:pb-16 md:pt-[calc(10rem+env(safe-area-inset-top))]">
          <Container>
            <div className="mx-auto max-w-3xl">
              <h1 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl lg:text-6xl">
                {support.heading}
              </h1>
              <p className="pretty mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary sm:text-xl">
                {support.intro}
              </p>
            </div>
          </Container>
        </section>

        <Section aria-labelledby="guides-heading">
          <div className="mx-auto max-w-3xl">
            <h2
              id="guides-heading"
              className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl"
            >
              {support.guidesHeading}
            </h2>

            <Link
              href={localizedPath(locale, "/support/modeles-et-budgets")}
              className="group mt-10 block rounded-[var(--radius-large)] border border-text/10 bg-surface p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none motion-reduce:transition-none sm:p-8"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                {support.guideCard.eyebrow}
              </p>
              <div className="mt-4 flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-text">
                    {support.guideCard.title}
                  </h3>
                  <p className="mt-3 max-w-2xl leading-relaxed text-text-secondary">
                    {support.guideCard.text}
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-primary transition-transform group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                  size={24}
                />
              </div>
            </Link>
          </div>
        </Section>

        <Section aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl">
            <h2
              id="faq-heading"
              className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl"
            >
              {support.faqHeading}
            </h2>

            <div className="mt-10 space-y-3">
              {faqs.map((faq) => (
                <AccordionItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </div>
        </Section>

        <Section aria-labelledby="contact-heading">
          <div className="mx-auto max-w-3xl border-t border-text/10 pt-10">
            <h2
              id="contact-heading"
              className="text-3xl font-bold leading-tight tracking-[-0.025em] text-text"
            >
              {support.contactHeading}
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-text-secondary">
              {support.contactText}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-text-secondary">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={`${linkClass} inline-flex min-h-11 items-center`}
              >
                {CONTACT_EMAIL}
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClass} inline-flex min-h-11 items-center`}
              >
                {support.contactGithub}
              </a>
            </div>
          </div>
        </Section>

        <FinalCTA dict={dict.home.finalCta} locale={locale} />
      </main>

      <Footer
        dict={dict.footer}
        language={dict.language}
        locale={locale}
        route="/support"
      />
    </>
  );
}
