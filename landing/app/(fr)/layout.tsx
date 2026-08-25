import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/RootDocument";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { rootMetadata, rootViewport } from "@/lib/metadata";
import "../globals.css";

// Racine française. Elle est servie à `/` sans préfixe : ses URL sont indexées,
// et `/fr/…` les dédoublerait. Deux root layouts gardent le français à la
// racine sans redirection ; `app/layout.tsx` ne doit donc pas exister, car sa
// seule présence empêcherait celui-ci d'être une racine.

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getDictionary(DEFAULT_LOCALE);
  return rootMetadata(DEFAULT_LOCALE, site);
}

export const viewport = rootViewport;

export default async function FrenchRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { site } = await getDictionary(DEFAULT_LOCALE);

  return (
    <RootDocument
      locale={DEFAULT_LOCALE}
      graphDescription={site.graphDescription}
      featureList={site.featureList}
    >
      {children}
    </RootDocument>
  );
}
