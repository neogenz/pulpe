import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Container, Section, Steps } from "@/components/ui";
import { Footer, Header } from "@/components/sections";
import type { Dictionary } from "@/content/dictionary";
import { CONTACT_EMAIL, MCP_SERVER_URL } from "@/lib/config";
import type { Locale } from "@/lib/i18n";
import { ASSISTANT_ROUTE, localizedPath } from "@/lib/routes";

// La commande du terminal n'est pas traduisible : c'est ce que le lecteur tape,
// caractère pour caractère. Elle vit donc ici, avec l'adresse du serveur, et pas
// dans les quatre catalogues où elle serait recopiée à l'identique.
const CLI_COMMAND = `claude mcp add --transport http pulpe ${MCP_SERVER_URL}`;

/**
 * Le bloc à recopier, défilable sur mobile. La graisse monospace n'est pas
 * décorative : la police du site ligature le double tiret de `--transport` en
 * un tiret long, et un lecteur qui recopie ce qu'il voit tape une commande que
 * son terminal refuse.
 */
function Snippet({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        {label}
      </p>
      <pre className="mt-3 overflow-x-auto rounded-[var(--radius-large)] border border-text/10 bg-surface p-4 font-mono text-sm leading-relaxed text-text sm:p-5">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export function SupportAssistant({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const { assistant } = dict;
  const modes = [assistant.readMode, assistant.writeMode];

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
        <section className="hero-mesh relative overflow-hidden pb-10 pt-[calc(8.5rem+env(safe-area-inset-top))] md:pb-16 md:pt-[calc(10rem+env(safe-area-inset-top))]">
          <Container>
            <div className="mx-auto max-w-4xl">
              <Link
                href={localizedPath(locale, "/support")}
                className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary transition-colors hover:text-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft aria-hidden="true" size={17} />
                {assistant.backToSupport}
              </Link>
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                {assistant.eyebrow}
              </p>
              <h1 className="balance mt-4 max-w-4xl text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-text sm:text-5xl lg:text-6xl">
                {assistant.heading}
              </h1>
              <p className="pretty mt-6 max-w-3xl text-lg leading-relaxed text-text-secondary sm:text-xl">
                {assistant.intro}
              </p>
            </div>
          </Container>
        </section>

        <Section aria-labelledby="abilities-heading">
          <div className="mx-auto max-w-4xl">
            <h2
              id="abilities-heading"
              className="max-w-3xl text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
            >
              {assistant.abilitiesHeading}
            </h2>

            <ul className="mt-10 divide-y divide-text/10 border-y border-text/10">
              {assistant.abilities.map((ability) => (
                <li key={ability} className="flex gap-4 py-5">
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-primary"
                    size={20}
                  />
                  <p className="leading-relaxed text-text-secondary">
                    {ability}
                  </p>
                </li>
              ))}
            </ul>

            <aside className="mt-10 rounded-[var(--radius-large)] border border-primary/15 bg-primary/6 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-text">
                {assistant.sourceTitle}
              </h3>
              <p className="mt-3 leading-relaxed text-text-secondary">
                {assistant.sourceText}
              </p>
            </aside>
          </div>
        </Section>

        <Section aria-labelledby="mode-heading">
          <div className="mx-auto max-w-4xl">
            <h2
              id="mode-heading"
              className="max-w-3xl text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
            >
              {assistant.modeHeading}
            </h2>
            <p className="pretty mt-5 max-w-3xl leading-relaxed text-text-secondary">
              {assistant.modeIntro}
            </p>

            <div className="mt-10 grid overflow-hidden rounded-[var(--radius-large)] border border-text/10 bg-surface md:grid-cols-2">
              {modes.map((mode, index) => (
                <article
                  key={mode.eyebrow}
                  className={
                    index === 0
                      ? "p-6 sm:p-8 md:border-r md:border-text/10"
                      : "border-t border-text/10 p-6 sm:p-8 md:border-t-0"
                  }
                >
                  <p
                    className={`text-sm font-semibold uppercase tracking-[0.14em] ${
                      index === 0 ? "text-primary" : "text-accent"
                    }`}
                  >
                    {mode.eyebrow}
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-text">
                    {mode.title}
                  </h3>
                  <p className="mt-4 leading-relaxed text-text-secondary">
                    {mode.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </Section>

        <Section aria-labelledby="connect-heading">
          <div className="mx-auto max-w-4xl">
            <header className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                {assistant.connectEyebrow}
              </p>
              <h2
                id="connect-heading"
                className="mt-3 text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
              >
                {assistant.connectHeading}
              </h2>
            </header>

            <Snippet label={assistant.addressLabel} value={MCP_SERVER_URL} />

            <p className="pretty mt-6 max-w-3xl leading-relaxed text-text-secondary">
              {assistant.availabilityNote}
            </p>

            <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-10">
              {assistant.clients.map((client) => (
                <article key={client.name}>
                  <h3 className="text-2xl font-semibold tracking-[-0.025em] text-text">
                    {client.name}
                  </h3>
                  <Steps items={client.steps} />
                </article>
              ))}
            </div>

            <Snippet label={assistant.commandLabel} value={CLI_COMMAND} />

            <div className="mt-12 border-t border-text/10 pt-10">
              <h3 className="text-2xl font-semibold tracking-[-0.025em] text-text">
                {assistant.consentTitle}
              </h3>
              <p className="mt-4 leading-relaxed text-text-secondary">
                {assistant.dataSharing}
              </p>
              <Steps items={assistant.consentSteps} />
            </div>
          </div>
        </Section>

        <Section aria-labelledby="revoke-heading">
          <div className="mx-auto max-w-4xl">
            <h2
              id="revoke-heading"
              className="max-w-3xl text-3xl font-bold leading-tight tracking-[-0.03em] text-text sm:text-4xl"
            >
              {assistant.revokeHeading}
            </h2>
            <p className="pretty mt-5 max-w-3xl leading-relaxed text-text-secondary">
              {assistant.revokeText}
            </p>

            <Steps items={assistant.revokeSteps} />

            <aside className="mt-10 rounded-[var(--radius-large)] border border-primary/15 bg-primary/6 p-6 sm:p-8">
              <p className="leading-relaxed text-text-secondary">
                {assistant.revokeNote}
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
              {assistant.contactHeading}
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-text-secondary">
              {assistant.contactText}
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

      <Footer
        dict={dict.footer}
        language={dict.language}
        locale={locale}
        route={ASSISTANT_ROUTE}
      />
    </>
  );
}
