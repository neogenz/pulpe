import type { Metadata } from "next";
import { getDictionary } from "@/content/dictionary";
import type { Locale } from "@/lib/i18n";
import { rootMetadata, socialMetadata } from "@/lib/metadata";
import { alternatesFor, ASSISTANT_ROUTE, GUIDE_ROUTE } from "@/lib/routes";

// Page metadata is defined once and shared by the French and prefixed shells.
// Duplicating it would let the two variants drift silently in search results.

export async function homeMetadata(locale: Locale): Promise<Metadata> {
  const { site } = await getDictionary(locale);
  return {
    ...rootMetadata(locale, site),
    alternates: {
      ...alternatesFor(locale, "/"),
      ...(locale === "fr" ? { types: { "text/markdown": "/index.md" } } : {}),
    },
  };
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
