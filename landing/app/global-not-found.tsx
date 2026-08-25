import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RootDocument } from "@/components/RootDocument";
import { Container, Button, FadeIn, GrainOverlay } from "@/components/ui";
import { getDictionary } from "@/content/dictionary";
import { ANGULAR_APP_URL } from "@/lib/config";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { APP_ICONS, rootViewport } from "@/lib/metadata";
import "./globals.css";

// A route-level `not-found.tsx` cannot cover both root layouts.
// `global-not-found` provides one shared custom 404 and renders a complete
// document, so it mounts the font, styles, and head itself.
//
// The page is French because that is the default language and an unknown URL
// does not provide a reliable locale.

export const metadata: Metadata = {
  title: "404",
  robots: { index: false, follow: false },
  icons: APP_ICONS,
};

export const viewport = rootViewport;

export default async function GlobalNotFound() {
  const { notFound, site } = await getDictionary(DEFAULT_LOCALE);

  return (
    <RootDocument
      locale={DEFAULT_LOCALE}
      graphDescription={site.graphDescription}
      featureList={site.featureList}
    >
      <div className="min-h-svh flex items-center justify-center bg-background relative overflow-hidden">
        <GrainOverlay />

        <Container className="text-center py-16 relative z-10">
          <FadeIn animateOnMount>
            <Link href="/" className="inline-flex items-center gap-2 mb-8">
              <Image src="/icon-64.webp" alt="Pulpe" width={32} height={32} />
              <span className="font-bold text-xl text-text">Pulpe</span>
            </Link>
          </FadeIn>

          <FadeIn animateOnMount delay={0.1}>
            <p
              className="text-[8rem] md:text-[12rem] font-bold leading-none text-primary/15 select-none"
              aria-hidden="true"
            >
              404
            </p>
          </FadeIn>

          <FadeIn animateOnMount delay={0.2}>
            <h1 className="text-2xl md:text-3xl font-bold text-text -mt-6 md:-mt-10">
              {notFound.title}
            </h1>
            <p className="text-text-secondary mt-3 max-w-md mx-auto">
              {notFound.text}
            </p>
          </FadeIn>

          <FadeIn animateOnMount delay={0.3}>
            <nav
              aria-label="Actions principales"
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8"
            >
              <Button href={ANGULAR_APP_URL} glow>
                {notFound.appCta}
              </Button>
              <Button href="/" variant="secondary">
                {notFound.homeCta}
              </Button>
            </nav>

            <nav
              aria-label="Ressources de récupération"
              className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm"
            >
              <a
                className="text-text-secondary hover:text-primary"
                href="/sitemap.xml"
              >
                Plan du site
              </a>
              <a
                className="text-text-secondary hover:text-primary"
                href="/llms.txt"
              >
                Instructions pour agents
              </a>
              <Link
                className="text-text-secondary hover:text-primary"
                href="/support"
              >
                Aide et contact
              </Link>
            </nav>
          </FadeIn>
        </Container>
      </div>
    </RootDocument>
  );
}
