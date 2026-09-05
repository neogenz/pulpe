import { ArrowRight } from "lucide-react";
import { Button, Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
import type { Locale } from "@/lib/i18n";
import { ASSISTANT_ROUTE, localizedPath } from "@/lib/routes";

export function Assistants({
  dict,
  locale,
}: {
  dict: Dictionary["assistant"];
  locale: Locale;
}) {
  const { promo } = dict;
  return (
    <Section id="assistants" aria-labelledby="assistants-heading">
      <div className="grid items-center gap-10 border-y border-text/10 py-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-sm font-semibold text-primary">{promo.status}</p>
          <h2
            id="assistants-heading"
            className="balance mt-4 text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl"
          >
            {promo.heading}
          </h2>
          <p className="pretty mt-5 text-lg leading-relaxed text-text-secondary">
            {promo.intro}
          </p>
          <p className="mt-5 leading-relaxed text-text-secondary">
            {dict.dataSharing}
          </p>
          <Button
            href={localizedPath(locale, ASSISTANT_ROUTE)}
            variant="secondary"
            className="mt-7 gap-2"
          >
            {promo.cta}
            <ArrowRight aria-hidden="true" size={18} />
          </Button>
        </div>
        <div className="rounded-[var(--radius-large)] bg-surface-alt p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-primary">
            {promo.examplesTitle}
          </h3>
          <ul className="mt-4 divide-y divide-primary/15">
            {promo.examples.map((example) => (
              <li key={example} className="py-5 text-lg leading-relaxed">
                <q>{example}</q>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            {promo.availability}
          </p>
        </div>
      </div>
    </Section>
  );
}
