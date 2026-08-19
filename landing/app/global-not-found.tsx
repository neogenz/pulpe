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

// Avec deux root layouts, un `not-found.tsx` posé dans l'un d'eux n'atteint
// jamais `404.html` — sans avertissement ni erreur — et l'export livre le 404
// intégré de Next, sans attribut `lang`. `global-not-found` est le seul moyen
// d'obtenir un 404 personnalisé ici ; il rend son document complet, donc il
// monte lui-même la police, les styles et l'en-tête.
//
// La page est en français : c'est la langue par défaut, et une URL inconnue ne
// porte par définition aucune langue fiable.

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
            <nav className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <Button href={ANGULAR_APP_URL} glow>
                {notFound.appCta}
              </Button>
              <Button href="/" variant="secondary">
                {notFound.homeCta}
              </Button>
            </nav>
          </FadeIn>
        </Container>
      </div>
    </RootDocument>
  );
}
