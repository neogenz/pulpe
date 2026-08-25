import { DEFAULT_LOCALE, LOCALES, type Locale } from "./i18n";

export const SITE_URL = "https://pulpe.app";

// The four localized pages, in sitemap order. Deriving `alternates` and the
// sitemap from one table guarantees that each version lists itself and closes
// the hreflang loop. Hand-written per-page maps eventually point at a 404,
// causing Google to ignore the whole group.
export const ROUTES = [
  "/",
  "/changelog",
  "/support",
  "/support/modeles-et-budgets",
] as const;

export type Route = (typeof ROUTES)[number];

// The guide slug remains French in all four languages. It is referenced in
// several places, and localized slugs would multiply that coupling for little
// value on a single page.
export const GUIDE_ROUTE = "/support/modeles-et-budgets" satisfies Route;

/**
 * Budget advice index and label.
 *
 * These pages exist only in French and target Swiss French search. A
 * translation without its own keyword work adds no value. They stay outside
 * `ROUTES`, which lists only pages available in all four languages; including
 * them would point each hreflang at a 404.
 */
export const ADVICE_INDEX_ROUTE = "/conseils-budget";
export const ADVICE_LABEL_FR = "Conseils budget";
export const CALCULATOR_ROUTE = "/calculateur-budget";
export const CALCULATOR_LABEL_FR = "Calculateur de budget";

// French trust anchors. They remain outside `ROUTES` so alternates and the
// footer do not advertise nonexistent translations.
export const ABOUT_ROUTE = "/about";
export const PRIVACY_ROUTE = "/privacy";
export const TRUST_ROUTES = [ABOUT_ROUTE, PRIVACY_ROUTE] as const;

/**
 * German advice, outside `ROUTES`. These pages are not available in all four
 * languages and their slugs do not mirror French. Including them would point
 * each hreflang at a 404. The German footer uses these labels directly rather
 * than `dict.links`.
 */
export const DE_ADVICE_SECTION_PATH = "/budget-ratgeber";
export const DE_COMPARISON_GUIDE_LABEL = "Beste Budget-App Schweiz";
export const DE_PREMIUMS_GUIDE_LABEL = "Krankenkassenprämien budgetieren";

/**
 * A link path in a given language. French remains at the root because its URLs
 * are indexed and `/fr/…` would duplicate them.
 *
 * Also accepts a hash (`/#pain-points`) used by the navigation bar. The locale
 * segment is inserted before `#`, never after it.
 */
export function localizedPath(locale: Locale, href: string): string {
  if (locale === DEFAULT_LOCALE) return href;

  const [path, hash] = href.split("#");
  const prefixed = path === "/" ? `/${locale}` : `/${locale}${path}`;
  return hash === undefined ? prefixed : `${prefixed}#${hash}`;
}

/**
 * The five hreflang entries for a page: four languages plus `x-default`.
 * Every version lists itself; a hreflang absent from the target page is ignored
 * rather than partially accepted.
 */
export function alternatesFor(locale: Locale, route: Route) {
  return {
    canonical: localizedPath(locale, route),
    languages: {
      ...Object.fromEntries(
        LOCALES.map((code) => [code, localizedPath(code, route)]),
      ),
      "x-default": localizedPath(DEFAULT_LOCALE, route),
    },
  };
}

/** Open Graph locale for each language, including Pulpe's primary market. */
export const OPEN_GRAPH_LOCALE: Record<Locale, string> = {
  fr: "fr_CH",
  en: "en_US",
  de: "de_DE",
  it: "it_IT",
};

export function openGraphAlternates(locale: Locale): string[] {
  const others = LOCALES.filter((code) => code !== locale).map(
    (code) => OPEN_GRAPH_LOCALE[code],
  );
  // Swiss and French French share one page. Pulpe serves both markets, and one
  // would be invisible without this entry.
  return locale === DEFAULT_LOCALE ? ["fr_FR", ...others] : others;
}
