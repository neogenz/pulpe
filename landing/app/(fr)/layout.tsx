import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/RootDocument";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { rootMetadata, rootViewport } from "@/lib/metadata";
import "../globals.css";

// French root. It is served at `/` without a prefix because its URLs are
// already indexed and `/fr/…` would duplicate them. Two root layouts keep
// French at the root without a redirect; `app/layout.tsx` must not exist,
// because its presence would prevent this file from being a root layout.

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
