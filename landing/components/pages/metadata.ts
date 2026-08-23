import type { Metadata } from "next";
import { getDictionary } from "@/content/dictionary";
import type { Locale } from "@/lib/i18n";
import { rootMetadata, socialMetadata } from "@/lib/metadata";
import { alternatesFor, ASSISTANT_ROUTE, GUIDE_ROUTE } from "@/lib/routes";

// Les métadonnées de chaque page sont écrites une fois et appelées par les deux
// coquilles, française et préfixée. Les dupliquer les laisserait diverger : une
// balise ajoutée d'un seul côté ne se voit dans aucun test, seulement dans les
// résultats de recherche, des semaines plus tard.

export async function homeMetadata(locale: Locale): Promise<Metadata> {
  const { site } = await getDictionary(locale);
  return rootMetadata(locale, site);
}

export async function changelogMetadata(locale: Locale): Promise<Metadata> {
  const { changelog, site } = await getDictionary(locale);
  const alternates = alternatesFor(locale, "/changelog");

  return {
    title: changelog.metaTitle,
    description: changelog.metaDescription,
    alternates,
    ...socialMetadata({
      locale,
      path: alternates.canonical,
      title: `${changelog.metaTitle} | Pulpe`,
      description: changelog.metaDescription,
      imageAlt: site.socialImageAlt,
      type: "website",
    }),
  };
}

export async function supportMetadata(locale: Locale): Promise<Metadata> {
  const { site, support } = await getDictionary(locale);
  const alternates = alternatesFor(locale, "/support");

  return {
    title: support.metaTitle,
    description: support.metaDescription,
    alternates,
    ...socialMetadata({
      locale,
      path: alternates.canonical,
      title: `${support.metaTitle} | Pulpe`,
      description: support.metaDescription,
      imageAlt: site.socialImageAlt,
      type: "website",
    }),
  };
}

export async function supportGuideMetadata(locale: Locale): Promise<Metadata> {
  const { guide, site } = await getDictionary(locale);
  const alternates = alternatesFor(locale, GUIDE_ROUTE);

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates,
    ...socialMetadata({
      locale,
      path: alternates.canonical,
      title: `${guide.metaTitle} | Pulpe`,
      description: guide.metaDescription,
      imageAlt: site.socialImageAlt,
      type: "article",
    }),
  };
}

export async function supportAssistantMetadata(
  locale: Locale,
): Promise<Metadata> {
  const { assistant, site } = await getDictionary(locale);
  const alternates = alternatesFor(locale, ASSISTANT_ROUTE);

  return {
    title: assistant.metaTitle,
    description: assistant.metaDescription,
    alternates,
    ...socialMetadata({
      locale,
      path: alternates.canonical,
      title: `${assistant.metaTitle} | Pulpe`,
      description: assistant.metaDescription,
      imageAlt: site.socialImageAlt,
      type: "article",
    }),
  };
}
