import Image from "next/image";
import type { ReactNode } from "react";
import { Check, Info, Smartphone } from "lucide-react";
import { CopyLinkButton } from "@/components/android/CopyLinkButton";
import { GroupMock, PlayMock } from "@/components/android/StepMockups";
import { AccordionItem, Button, Container, Section } from "@/components/ui";
import { Footer, Header } from "@/components/sections";
import type { Dictionary } from "@/content/dictionary";
import {
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_OPT_IN_URL,
  ANDROID_PLAY_STORE_URL,
  CONTACT_EMAIL,
} from "@/lib/config";
import type { Locale } from "@/lib/i18n";
import { ANDROID_ROUTE, localizedPath, SITE_URL } from "@/lib/routes";

const linkClass =
  "rounded-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Google pages open in a new tab so this one stays put for the next step.
const external = { target: "_blank", rel: "noopener noreferrer" } as const;

function Step({
  number,
  title,
  text,
  actions,
  visual,
}: {
  number: number;
  title: string;
  text: string;
  actions: ReactNode;
  visual: ReactNode;
}) {
  return (
    <li className="grid items-center gap-10 rounded-[var(--radius-large)] bg-surface p-6 shadow-[var(--shadow-organic)] outline outline-1 -outline-offset-1 outline-black/5 sm:p-9 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-12">
      <div>
        <div className="flex items-start gap-4">
          {/* The `ol` already announces the number. */}
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-white"
          >
            {number}
          </span>
          <h3 className="balance pt-1 text-2xl font-semibold leading-tight tracking-[-0.025em] text-text sm:text-3xl">
            {title}
          </h3>
        </div>
        <p className="pretty mt-4 text-lg leading-relaxed text-text-secondary">
          {text}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:items-start">{actions}</div>
      </div>
      {visual}
    </li>
  );
}

export function AndroidBeta({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const page = dict.androidBeta;
  const path = localizedPath(locale, ANDROID_ROUTE);
  // Asks Android to reopen this page in Chrome, out of Instagram's browser.
  const chromeIntent = `intent://${new URL(SITE_URL).host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
  const faqs = [page.faq.joinButton, page.faq.install, page.faq.leave];

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        {dict.common.skipToContent}
      </a>

      <Header dict={dict.header} locale={locale} />

      <main id="main-content" tabIndex={-1}>
        <section className="hero-mesh relative overflow-hidden pb-10 pt-[calc(8rem+env(safe-area-inset-top))] md:pb-14 md:pt-[calc(10rem+env(safe-area-inset-top))]">
          <Container>
            <div className="mx-auto max-w-4xl">
              <h1 className="balance text-[clamp(2.5rem,7vw,4.25rem)] font-extrabold leading-[1.02] tracking-[-0.04em] text-text">
                {page.heading}
              </h1>
              <p className="pretty mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary sm:text-xl">
                {page.intro}
              </p>
              <ul className="mt-8 flex flex-wrap gap-2">
                {page.promises.map((promise) => (
                  <li
                    key={promise}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium text-text shadow-[var(--shadow-organic)] outline outline-1 -outline-offset-1 outline-primary/15"
                  >
                    <Check
                      className="size-4 text-primary"
                      strokeWidth={2.4}
                      aria-hidden="true"
                    />
                    {promise}
                  </li>
                ))}
              </ul>

              <p className="mt-8 flex items-start gap-3 rounded-[var(--radius-card)] border border-text/10 bg-surface p-4 text-text-secondary android:hidden">
                <Smartphone
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                {page.desktopNote}
              </p>

              <div className="mt-8 hidden rounded-[var(--radius-large)] bg-surface p-6 shadow-[var(--shadow-organic)] outline outline-2 -outline-offset-2 outline-primary/25 in-app:block">
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-text">
                  {page.inApp.title}
                </h2>
                <p className="pretty mt-2 leading-relaxed text-text-secondary">
                  {page.inApp.text}
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button
                    href={chromeIntent}
                    className="hidden android:inline-flex"
                    data-cta-name="android_beta_open_chrome"
                    data-cta-location="android_in_app"
                    data-cta-destination="chrome"
                  >
                    {page.inApp.openChrome}
                  </Button>
                  <CopyLinkButton
                    label={page.inApp.copyLink}
                    copiedLabel={page.inApp.copied}
                  />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-text-secondary">
                  {page.inApp.manual}
                </p>
              </div>
            </div>
          </Container>
        </section>

        <Section aria-labelledby="steps-heading">
          <div className="mx-auto max-w-4xl">
            <h2
              id="steps-heading"
              className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl"
            >
              {page.stepsHeading}
            </h2>
            <ol className="mt-10 space-y-5">
              <Step
                number={1}
                title={page.join.title}
                text={page.join.text}
                actions={
                  <Button
                    href={ANDROID_BETA_GROUP_URL}
                    {...external}
                    data-cta-name="android_beta_join_group"
                    data-cta-location="android_step_1"
                    data-cta-destination={ANDROID_BETA_GROUP_URL}
                  >
                    {page.join.cta}
                  </Button>
                }
                visual={
                  <GroupMock
                    label={page.join.mockAlt}
                    button={page.join.mockButton}
                  />
                }
              />
              <Step
                number={2}
                title={page.install.title}
                text={page.install.text}
                actions={
                  <>
                    <Button
                      href={ANDROID_BETA_OPT_IN_URL}
                      {...external}
                      data-cta-name="android_beta_accept_test"
                      data-cta-location="android_step_2"
                      data-cta-destination={ANDROID_BETA_OPT_IN_URL}
                    >
                      {page.install.cta}
                    </Button>
                    <Button
                      href={ANDROID_PLAY_STORE_URL}
                      variant="secondary"
                      {...external}
                      data-cta-name="android_beta_install"
                      data-cta-location="android_step_2"
                      data-cta-destination={ANDROID_PLAY_STORE_URL}
                    >
                      {page.install.storeCta}
                    </Button>
                  </>
                }
                visual={
                  <PlayMock
                    label={page.install.mockAlt}
                    button={page.install.mockButton}
                  />
                }
              />
            </ol>
            <p className="mt-6 flex items-start gap-3 text-text-secondary">
              <Info
                className="mt-1 size-5 shrink-0 text-accent"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              {page.sameAccount}
            </p>
          </div>
        </Section>

        <Section aria-labelledby="why-heading">
          <div className="mx-auto grid max-w-4xl items-start gap-7 sm:grid-cols-[8rem_minmax(0,1fr)] lg:gap-10">
            <Image
              src="/maxime-portrait.webp"
              alt={page.portraitAlt}
              width={640}
              height={800}
              className="aspect-square w-24 rounded-[var(--radius-large)] object-cover object-[50%_28%] shadow-[var(--shadow-organic)] sm:w-full"
            />
            <div>
              <h2
                id="why-heading"
                className="text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
              >
                {page.whyHeading}
              </h2>
              <div className="mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-text-secondary">
                {page.whyParagraphs.map((paragraph) => (
                  <p key={paragraph} className="pretty">
                    {paragraph}
                  </p>
                ))}
              </div>
              <p className="mt-6 font-semibold text-text">{page.signature}</p>
            </div>
          </div>
        </Section>

        <Section aria-labelledby="faq-heading" className="pb-20 lg:pb-30">
          <div className="mx-auto max-w-4xl">
            <h2
              id="faq-heading"
              className="text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
            >
              {page.faqHeading}
            </h2>
            <div className="mt-8 space-y-3">
              {faqs.map((faq) => (
                <AccordionItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
            <p className="mt-8 text-text-secondary">
              {page.contactText}{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </Section>
      </main>

      <Footer
        dict={dict.footer}
        language={dict.language}
        locale={locale}
        route={ANDROID_ROUTE}
      />
    </>
  );
}
