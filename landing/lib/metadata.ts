import type { Metadata, Viewport } from "next";
import type { Dictionary } from "@/content/dictionary";
import { DEFAULT_LOCALE, type Locale } from "./i18n";
import {
  alternatesFor,
  OPEN_GRAPH_LOCALE,
  openGraphAlternates,
  SITE_URL,
} from "./routes";

// Les trois documents racines — français, préfixé, 404 — partagent la même
// fenêtre. `viewportFit: cover` est ce qui laisse la landing s'étendre sous
// l'encoche iOS ; l'oublier sur l'un des trois ne se voit que sur l'appareil.
export const rootViewport: Viewport = {
  themeColor: "#eaf6e6",
  viewportFit: "cover",
};

// Les icônes suivent le document, pas la page : elles valent aussi pour le 404.
export const APP_ICONS = {
  icon: "/icon-192.png",
  apple: "/apple-touch-icon.png",
} as const;

/**
 * Le fichier de la carte sociale d'une langue. Le français garde son nom
 * d'origine : cette URL circule déjà dans des partages, et la renommer
 * remplacerait la vignette de chacun d'eux par un carré vide.
 *
 * `scripts/generate-og-image.ts` écrit ces fichiers ; le nom vient d'ici pour
 * que la balise et le PNG ne puissent pas désigner deux choses différentes.
 */
export function socialPreviewFile(locale: Locale): string {
  return locale === DEFAULT_LOCALE
    ? "pulpe-social-preview.png"
    : `pulpe-social-preview-${locale}.png`;
}

// Le `?v=` force les caches sociaux à recharger la vignette après un changement
// de visuel. Le français en est à sa deuxième version.
const SOCIAL_PREVIEW_VERSION: Record<Locale, number> = {
  fr: 2,
  en: 1,
  de: 1,
  it: 1,
};

export function socialPreviewImage(locale: Locale): string {
  return `/${socialPreviewFile(locale)}?v=${SOCIAL_PREVIEW_VERSION[locale]}`;
}

function socialImages(locale: Locale, alt: string) {
  return [
    {
      url: socialPreviewImage(locale),
      width: 1200,
      height: 630,
      alt,
      type: "image/png",
    },
  ];
}

/**
 * Les métadonnées portées par les deux root layouts. Elles sont écrites une
 * fois : deux racines indépendantes qui déclareraient chacune leur `title`
 * template ou leur `metadataBase` finiraient par diverger sans que rien ne le
 * signale.
 */
export function rootMetadata(
  locale: Locale,
  site: Dictionary["site"],
): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      template: site.titleTemplate,
      default: site.titleDefault,
    },
    description: site.description,
    applicationName: "Pulpe",
    verification: {
      google: "20-QgsBLcccy2f1lY275s0mayKmxWZZWo9Rg8aGxTQ0",
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: alternatesFor(locale, "/"),
    openGraph: {
      title: site.titleDefault,
      description: site.description,
      siteName: "Pulpe",
      type: "website",
      url: alternatesFor(locale, "/").canonical,
      locale: OPEN_GRAPH_LOCALE[locale],
      alternateLocale: openGraphAlternates(locale),
      images: socialImages(locale, site.socialImageAlt),
    },
    twitter: {
      card: "summary_large_image",
      title: site.titleDefault,
      description: site.description,
      images: socialImages(locale, site.socialImageAlt),
    },
    icons: APP_ICONS,
  };
}

/**
 * Les métadonnées sociales d'une page qui parle d'elle-même plutôt que du site,
 * comme le guide. Les pages qui n'en déclarent pas héritent de celles du
 * layout, ce qui reste le comportement d'origine.
 */
export function socialMetadata({
  locale,
  path,
  title,
  description,
  imageAlt,
  type,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  imageAlt: string;
  type: "article" | "website";
}): Pick<Metadata, "openGraph" | "twitter"> {
  const images = socialImages(locale, imageAlt);

  return {
    openGraph: {
      title,
      description,
      siteName: "Pulpe",
      type,
      url: path,
      locale: OPEN_GRAPH_LOCALE[locale],
      alternateLocale: openGraphAlternates(locale),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}
