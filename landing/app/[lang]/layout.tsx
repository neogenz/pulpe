import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/RootDocument";
import { getDictionary } from "@/content/dictionary";
import { assertPrefixedLocale, PREFIXED_LOCALES } from "@/lib/i18n";
import { rootMetadata, rootViewport } from "@/lib/metadata";
import "../globals.css";

// Root for the three prefixed languages. `generateStaticParams` never emits
// `fr`, which would duplicate every indexed French URL under `/fr/…`.
// Unsupported values remain explicitly closed so they still return a real 404.

export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = assertPrefixedLocale((await params).lang);
  const { site } = await getDictionary(locale);
  return rootMetadata(locale, site);
}

export const viewport = rootViewport;

export default async function LocalizedRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const locale = assertPrefixedLocale((await params).lang);
  const { site } = await getDictionary(locale);

  return (
    <RootDocument
      locale={locale}
      graphDescription={site.graphDescription}
      featureList={site.featureList}
    >
      {children}
    </RootDocument>
  );
}
