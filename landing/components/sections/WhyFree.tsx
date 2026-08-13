import Image from "next/image";
import { CodeXml, ExternalLink, Server, ShieldCheck } from "lucide-react";
import { Section } from "@/components/ui";
import type { Dictionary } from "@/content/dictionary";
import { GITHUB_URL } from "@/lib/config";

const GUARANTEE_IDS = ["encryption", "analytics", "openSource"] as const;

const GUARANTEE_ICONS = {
  encryption: ShieldCheck,
  analytics: Server,
  openSource: CodeXml,
} as const;

export function WhyFree({ dict }: { dict: Dictionary["home"]["whyFree"] }) {
  const guarantees = GUARANTEE_IDS.map((id) => ({
    icon: GUARANTEE_ICONS[id],
    ...dict.guarantees[id],
  }));

  return (
    <Section id="why-free">
      <div className="mx-auto max-w-5xl">
        <div className="grid items-start gap-7 sm:grid-cols-[9rem_minmax(0,1fr)] lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
          <Image
            src="/maxime-portrait.webp"
            alt={dict.portraitAlt}
            width={640}
            height={800}
            className="aspect-square w-28 rounded-[var(--radius-large)] object-cover object-[50%_28%] shadow-[var(--shadow-organic)] sm:w-full"
          />

          <div>
            <p className="mb-3 font-semibold text-primary">{dict.eyebrow}</p>
            <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
              {dict.heading}
            </h2>
            <div className="mt-7 max-w-3xl space-y-5 text-lg leading-relaxed text-text-secondary">
              {dict.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="mt-7 font-semibold text-text">{dict.signature}</p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {dict.sourceLink}
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <dl className="mt-12 grid border-t border-text/10 pt-2 md:grid-cols-3 lg:mt-16">
          {guarantees.map((guarantee, index) => (
            <div
              key={guarantee.title}
              className={`py-7 md:px-7 ${
                index > 0
                  ? "border-t border-text/10 md:border-l md:border-t-0"
                  : "md:pl-0"
              } ${index === guarantees.length - 1 ? "md:pr-0" : ""}`}
            >
              <dt className="flex items-center gap-3 font-semibold text-text">
                <guarantee.icon
                  className="size-5 text-primary"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                {guarantee.title}
              </dt>
              <dd className="mt-3 text-sm leading-relaxed text-text-secondary">
                {guarantee.text}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
