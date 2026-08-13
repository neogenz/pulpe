import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/ui";
import { Footer, Header } from "@/components/sections";
import { getDictionary } from "@/content/dictionary";
import { CONTACT_EMAIL } from "@/lib/config";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const GUIDE_PATH = "/support/modeles-et-budgets";
const SOCIAL_PREVIEW_IMAGE = "/pulpe-social-preview.png?v=2";

export async function generateMetadata(): Promise<Metadata> {
  const { guide, site } = await getDictionary(DEFAULT_LOCALE);
  const socialTitle = `${guide.metaTitle} | Pulpe`;

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: {
      canonical: GUIDE_PATH,
    },
    openGraph: {
      title: socialTitle,
      description: guide.metaDescription,
      siteName: "Pulpe",
      type: "article",
      url: GUIDE_PATH,
      locale: "fr_CH",
      alternateLocale: ["fr_FR"],
      images: [
        {
          url: SOCIAL_PREVIEW_IMAGE,
          width: 1200,
          height: 630,
          alt: site.socialImageAlt,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: guide.metaDescription,
      images: [
        {
          url: SOCIAL_PREVIEW_IMAGE,
          alt: site.socialImageAlt,
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

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

export default async function ModelsAndBudgetsGuidePage() {
  const dict = await getDictionary(DEFAULT_LOCALE);
  const { guide } = dict;

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        {dict.common.skipToContent}
      </a>

      <Header dict={dict.header} />

      <main id="main-content" tabIndex={-1}>
        <section className="hero-mesh relative overflow-hidden pb-10 pt-[calc(8.5rem+env(safe-area-inset-top))] md:pb-16 md:pt-[calc(10rem+env(safe-area-inset-top))]">
          <Container>
            <div className="mx-auto max-w-4xl">
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary transition-colors hover:text-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft aria-hidden="true" size={17} />
                {guide.backToSupport}
              </Link>
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                {guide.eyebrow}
              </p>
              <h1 className="balance mt-4 max-w-4xl text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl lg:text-6xl">
                {guide.heading}
              </h1>
              <p className="pretty mt-6 max-w-3xl text-lg leading-relaxed text-text-secondary sm:text-xl">
                {guide.intro}
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
              {guide.differenceHeading}
            </h2>

            <div className="mt-10 grid overflow-hidden rounded-[var(--radius-large)] border border-text/10 bg-surface md:grid-cols-2">
              <article className="p-6 sm:p-8 md:border-r md:border-text/10">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                  {guide.template.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-text">
                  {guide.template.title}
                </h3>
                <p className="mt-4 leading-relaxed text-text-secondary">
                  {guide.template.text}
                </p>
              </article>

              <article className="border-t border-text/10 p-6 sm:p-8 md:border-t-0">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                  {guide.budget.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-text">
                  {guide.budget.title}
                </h3>
                <p className="mt-4 leading-relaxed text-text-secondary">
                  {guide.budget.text}
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
              {guide.choiceHeading}
            </h2>

            <dl className="mt-10 divide-y divide-text/10 border-y border-text/10">
              {guide.choices.map((choice) => (
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
                {guide.iphoneEyebrow}
              </p>
              <h2
                id="iphone-heading"
                className="mt-3 text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
              >
                {guide.iphoneHeading}
              </h2>
            </header>

            <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
              <article>
                <p className="text-sm font-semibold text-accent">
                  {guide.budgetSteps.eyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-text">
                  {guide.budgetSteps.title}
                </h3>
                <Steps items={guide.budgetSteps.steps} />
              </article>

              <article className="border-t border-text/10 pt-10 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
                <p className="text-sm font-semibold text-primary">
                  {guide.modelSteps.eyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-text">
                  {guide.modelSteps.title}
                </h3>
                <Steps items={guide.modelSteps.steps} />
              </article>
            </div>

            <aside className="mt-12 rounded-[var(--radius-large)] border border-primary/15 bg-primary/6 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-text">
                {guide.protectedTitle}
              </h3>
              {guide.protectedParagraphs.map((paragraph, index) => (
                <p
                  key={paragraph}
                  className={`${index === 0 ? "mt-3" : "mt-4"} leading-relaxed text-text-secondary`}
                >
                  {paragraph}
                </p>
              ))}
            </aside>
          </div>
        </Section>

        <Section aria-labelledby="contact-heading">
          <div className="mx-auto max-w-4xl border-t border-text/10 pt-10">
            <h2
              id="contact-heading"
              className="text-3xl font-bold leading-tight tracking-[-0.025em] text-text"
            >
              {guide.contactHeading}
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-text-secondary">
              {guide.contactText}
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

      <Footer dict={dict.footer} />
    </>
  );
}
