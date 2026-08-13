import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Container } from "@/components/ui";
import { Header, Footer } from "@/components/sections";
import releases from "@/data/releases.json";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { changelog } = await getDictionary(DEFAULT_LOCALE);

  return {
    title: changelog.metaTitle,
    description: changelog.metaDescription,
    alternates: {
      canonical: "/changelog",
    },
  };
}

const PLATFORM_STYLES: Record<string, { label: string; className: string }> = {
  web: { label: "Web", className: "bg-accent/10 text-accent" },
  ios: { label: "iOS", className: "bg-[#007AFF]/10 text-[#007AFF]" },
  android: { label: "Android", className: "bg-[#34A853]/10 text-[#34A853]" },
};

const SECTION_KEYS = ["features", "fixes", "technical"] as const;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-CH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ChangelogPage() {
  const dict = await getDictionary(DEFAULT_LOCALE);
  const { changelog } = dict;

  return (
    <>
      <Header dict={dict.header} />

      <main className="pt-32 pb-16 md:pb-24">
        <Container>
          <div className="max-w-4xl mx-auto">
            <header className="mb-16 md:mb-20">
              <h1 className="text-4xl md:text-5xl font-bold text-text tracking-tight mb-3">
                {changelog.heading}
              </h1>
              <p className="text-text-secondary text-lg">{changelog.intro}</p>
            </header>

            <div>
              {releases.map((release, index) => (
                <article
                  key={release.version}
                  id={`v${release.version}`}
                  className={`grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 md:gap-12 pb-14 md:pb-16 ${
                    index < releases.length - 1
                      ? "mb-14 md:mb-16 border-b border-text/8"
                      : ""
                  }`}
                >
                  {/* Left column — version + date + platforms (sticky on desktop) */}
                  <div className="md:sticky md:top-28 md:self-start">
                    <p className="text-2xl font-bold text-text tracking-tight">
                      v{release.version}
                    </p>
                    <time
                      dateTime={release.date}
                      className="block text-sm text-text-secondary mt-1"
                    >
                      {formatDate(release.date)}
                    </time>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {release.platforms.map((platform) => {
                        const style = PLATFORM_STYLES[platform];
                        if (!style) return null;
                        return (
                          <span
                            key={platform}
                            className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${style.className}`}
                          >
                            {style.label}
                          </span>
                        );
                      })}
                    </div>
                    {release.githubUrl && (
                      <a
                        href={release.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs text-text-secondary hover:text-primary transition-colors"
                      >
                        <ExternalLink size={12} />
                        {changelog.githubRelease}
                      </a>
                    )}
                  </div>

                  {/* Right column — release content */}
                  <div className="space-y-8">
                    {release.headline && (
                      <p className="text-lg font-semibold text-text">
                        {release.headline}
                      </p>
                    )}
                    {release.description && (
                      <p className="text-text-secondary leading-relaxed">
                        {release.description}
                      </p>
                    )}
                    {SECTION_KEYS.map((key) => {
                      const items = release.changes[key];
                      if (!items || items.length === 0) return null;
                      return (
                        <section key={key}>
                          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
                            {changelog.sections[key]}
                          </h2>
                          <ul className="space-y-3">
                            {items.map((item, i) => (
                              <li key={i} className="leading-relaxed">
                                <span className="font-medium text-text">
                                  {item.title}
                                </span>
                                <span className="text-text-secondary">
                                  {" "}
                                  &mdash; {item.description}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </main>

      <Footer dict={dict.footer} />
    </>
  );
}
