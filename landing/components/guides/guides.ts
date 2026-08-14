import type { Metadata } from "next";

// Source unique de vérité des guides : l'index /conseils-budget, le sitemap et
// les métadonnées d'article lisent tous ce registre. Publier un guide = une
// entrée ici + une page sous app/conseils-budget/<slug>/.
export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Date ISO yyyy-mm-dd. */
  publishedAt: string;
  /** Date ISO yyyy-mm-dd — alimente dateModified (JSON-LD) et lastmod (sitemap). */
  updatedAt: string;
  readingMinutes: number;
}

export const GUIDES: Guide[] = [
  {
    slug: "comment-faire-son-budget-en-suisse",
    title: "Comment faire son budget en Suisse",
    description:
      "La méthode en quatre étapes pour poser ton budget suisse : revenus, prévisions, épargne, et le disponible à dépenser qui reste chaque mois.",
    publishedAt: "2026-08-13",
    updatedAt: "2026-08-13",
    readingMinutes: 6,
  },
];

// Copie assumée du couple layout.tsx / modeles-et-budgets : le test a11y exige
// que layout.tsx déclare le sien. Une seule copie ici pour tous les guides.
export const SOCIAL_PREVIEW_IMAGE = "/pulpe-social-preview.png?v=2";
const SOCIAL_PREVIEW_ALT =
  "Pulpe projette ton budget sur l’année et montre combien il te restera";

export function getGuide(slug: string): Guide {
  const guide = GUIDES.find((candidate) => candidate.slug === slug);
  // Échec de build bruyant si la page et le registre divergent.
  if (!guide) {
    throw new Error(`Guide absent du registre : ${slug}`);
  }
  return guide;
}

// Métadonnées partagées : une page d'article se réduit à `guideMetadata(guide)`.
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
