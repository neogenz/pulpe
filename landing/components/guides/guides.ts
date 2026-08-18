import type { Metadata } from "next";
import { getDictionary } from "@/content/dictionary";
import { socialPreviewImage } from "@/lib/metadata";
import { localizedPath } from "@/lib/routes";
import { FR_GUIDE_CHROME, type GuideChrome } from "./chrome";

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
  {
    slug: "budgeter-primes-maladie",
    title: "Primes maladie 2026 : comment les provisionner dans ton budget",
    description:
      "La prime moyenne 2026 est à 393.30 CHF. Voici comment répartir la hausse sur l’année, sans attendre la facture de janvier.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
  },
  {
    slug: "meilleure-app-budget-suisse",
    title: "Meilleure app de budget en Suisse : comparatif 2026",
    description:
      "Cinq apps de budget utilisables en Suisse, comparées sur le prix, le français, le franc suisse et la connexion bancaire. Sans classement payant.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 9,
  },
  {
    slug: "alternative-ynab-suisse",
    title: "Alternative à YNAB en Suisse : options gratuites en français",
    description:
      "YNAB est en dollars et en anglais. Voici les alternatives suisses, gratuites ou en francs, pour planifier son budget sans compte bancaire branché.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
  },
  {
    slug: "pulpe-vs-budgetch",
    title: "Pulpe ou BudgetCH : quelle app de budget choisir ?",
    description:
      "Deux apps gratuites, deux métiers. BudgetCH suit le mois. Pulpe projette l’année. Voici pour qui chacune convient.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 6,
  },
  {
    slug: "pulpe-vs-budgethub",
    title: "Pulpe ou BudgetHub : quelle app de budget choisir ?",
    description:
      "Deux apps suisses sans connexion bancaire obligatoire. L’une importe tes CSV et propose une IA. L’autre projette tes mois à venir, gratuitement et sans plafond.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 6,
  },
  {
    slug: "budget-mensuel-suisse-exemple",
    title: "Exemple de budget mensuel en Suisse",
    description:
      "Trois budgets types (jeune actif, couple, étudiant) avec salaire médian, loyer et primes, puis ce qu’il reste si tu regardes l’année, pas seulement le mois.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
  },
  {
    slug: "epargner-avec-salaire-suisse",
    title: "Combien épargner avec un salaire suisse ?",
    description:
      "Repères autour du salaire médian de 7’024 CHF, méthode « payer son épargne d’abord », fonds de secours et pilier 3a — sans viser un pourcentage magique.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
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
// Without chrome, the French social card and canonical stay as they are:
// these pages only exist in French. Passing chrome switches path, locale,
// and vignette together so a DE article cannot keep a FR card.
export async function guideMetadata(
  guide: Guide,
  chrome: GuideChrome = FR_GUIDE_CHROME,
): Promise<Metadata> {
  const path = localizedPath(
    chrome.locale,
    `${chrome.sectionPath}/${guide.slug}`,
  );
  const socialTitle = `${guide.title} | Pulpe`;
  const image = socialPreviewImage(chrome.locale);
  const imageAlt = (await getDictionary(chrome.locale)).site.socialImageAlt;
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
      locale: chrome.ogLocale,
      ...(chrome.alternateLocale
        ? { alternateLocale: [...chrome.alternateLocale] }
        : {}),
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
