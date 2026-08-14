import type { Metadata } from "next";
import { SOCIAL_PREVIEW_ALT, SOCIAL_PREVIEW_IMAGE } from "@/lib/config";

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
export function guideMetadata(guide: Guide): Metadata {
  const path = `/conseils-budget/${guide.slug}`;
  const socialTitle = `${guide.title} | Pulpe`;
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
          url: SOCIAL_PREVIEW_IMAGE,
          width: 1200,
          height: 630,
          alt: SOCIAL_PREVIEW_ALT,
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
          url: SOCIAL_PREVIEW_IMAGE,
          alt: SOCIAL_PREVIEW_ALT,
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}
