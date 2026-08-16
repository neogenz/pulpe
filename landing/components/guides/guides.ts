import type { Metadata } from "next";
import { getDictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { socialPreviewImage } from "@/lib/metadata";

// Single source of truth: the /conseils-budget index, sitemap, and article
// metadata all read this registry. Publishing requires an entry here and a
// page under app/conseils-budget/<slug>/.
export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Date ISO yyyy-mm-dd. */
  publishedAt: string;
  /** ISO yyyy-mm-dd date feeding JSON-LD dateModified and sitemap lastmod. */
  updatedAt: string;
  readingMinutes: number;
}

export const GUIDES: readonly Guide[] = [
  {
    slug: "comment-faire-son-budget-en-suisse",
    title: "Comment faire son budget en Suisse",
    description:
      "La méthode en quatre étapes pour poser ton budget suisse : revenus, prévisions, épargne, et le disponible à dépenser qui reste chaque mois.",
    publishedAt: "2026-08-13",
    updatedAt: "2026-08-14",
    readingMinutes: 6,
  },
];

export function getGuide(slug: string): Guide {
  const guide = GUIDES.find((candidate) => candidate.slug === slug);
  // Fail the build loudly when a page and registry entry drift apart.
  if (!guide) {
    throw new Error(`Guide missing from registry: ${slug}`);
  }
  return guide;
}

// Shared metadata keeps an article page to `guideMetadata(guide)`.
//
// These pages only exist in French, so they carry the French social card rather
// than resolving one per language.
export async function guideMetadata(guide: Guide): Promise<Metadata> {
  const path = `/conseils-budget/${guide.slug}`;
  const socialTitle = `${guide.title} | Pulpe`;
  const image = socialPreviewImage(DEFAULT_LOCALE);
  const imageAlt = (await getDictionary(DEFAULT_LOCALE)).site.socialImageAlt;
  return {
    title: guide.title,
    description: guide.description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: socialTitle,
      description: guide.description,
      siteName: "Pulpe",
      type: "article",
      url: path,
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
      locale: "fr_CH",
      alternateLocale: ["fr_FR"],
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: imageAlt,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: guide.description,
      images: [
        {
          url: image,
          alt: imageAlt,
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}
