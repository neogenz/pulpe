import type { Metadata } from "next";
import { getDictionary } from "@/content/dictionary";
import type { Locale } from "@/lib/i18n";
import { articleSocialMetadata, rootMetadata } from "@/lib/metadata";
import { alternatesFor, GUIDE_ROUTE } from "@/lib/routes";

// Les métadonnées de chaque page sont écrites une fois et appelées par les deux
// coquilles, française et préfixée. Les dupliquer les laisserait diverger : une
// balise ajoutée d'un seul côté ne se voit dans aucun test, seulement dans les
// résultats de recherche, des semaines plus tard.

export async function homeMetadata(locale: Locale): Promise<Metadata> {
  const { site } = await getDictionary(locale);
  return rootMetadata(locale, site);
}

export async function changelogMetadata(locale: Locale): Promise<Metadata> {
  const { changelog } = await getDictionary(locale);

  return {
    title: changelog.metaTitle,
    description: changelog.metaDescription,
    alternates: alternatesFor(locale, "/changelog"),
  };
}

export async function supportMetadata(locale: Locale): Promise<Metadata> {
  const { support } = await getDictionary(locale);

  return {
    title: support.metaTitle,
    description: support.metaDescription,
    alternates: alternatesFor(locale, "/support"),
  };
}

export async function supportGuideMetadata(locale: Locale): Promise<Metadata> {
  const { guide, site } = await getDictionary(locale);
  const alternates = alternatesFor(locale, GUIDE_ROUTE);

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates,
    ...articleSocialMetadata({
      locale,
      path: alternates.canonical,
      title: `${guide.metaTitle} | Pulpe`,
      description: guide.metaDescription,
      imageAlt: site.socialImageAlt,
    }),
  };
}
