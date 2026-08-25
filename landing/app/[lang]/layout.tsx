import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/RootDocument";
import { getDictionary } from "@/content/dictionary";
import { assertPrefixedLocale, PREFIXED_LOCALES } from "@/lib/i18n";
import { rootMetadata, rootViewport } from "@/lib/metadata";
import "../globals.css";

// Racine des trois langues préfixées. `generateStaticParams` n'émet jamais
// `fr` : ce segment produirait `/fr/…` en double de chaque URL française déjà
// indexée. Les autres valeurs restent explicitement fermées pour conserver un
// vrai 404 maintenant que le site n'utilise plus l'export pur.

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
