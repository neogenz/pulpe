import { DEFAULT_LOCALE, LOCALES, type Locale } from "./i18n";

export const SITE_URL = "https://pulpe.app";

// Les quatre pages du site, dans l'ordre du plan. Une seule table : dériver les
// `alternates` et le sitemap de la même source est la seule façon de garantir
// qu'une version se liste elle-même et que la boucle hreflang se referme. Une
// carte écrite à la main page par page finit par pointer vers un 404, et Google
// ignore alors le groupe entier au lieu de le dégrader.
export const ROUTES = [
  "/",
  "/changelog",
  "/support",
  "/support/modeles-et-budgets",
] as const;

export type Route = (typeof ROUTES)[number];

// Le slug du guide reste français dans les quatre langues : il est en dur à
// plusieurs endroits, et des slugs par langue multiplieraient ce couplage pour
// un gain marginal sur une page unique.
export const GUIDE_ROUTE = "/support/modeles-et-budgets" satisfies Route;

/**
 * L'index des conseils budget et son libellé.
 *
 * Ces pages n'existent qu'en français : elles visent la recherche francophone
 * suisse, et une traduction sans son propre travail de mots-clés n'y apporte
 * rien. Elles sont donc hors de `ROUTES`, qui ne liste que ce dont les quatre
 * langues ont une version — les y mettre ferait pointer chaque `hreflang` vers
 * un 404.
 */
export const ADVICE_INDEX_ROUTE = "/conseils-budget";
export const ADVICE_LABEL_FR = "Conseils budget";

/**
 * Le chemin d'un lien dans une langue donnée. Le français reste à la racine :
 * ses URL sont indexées, et `/fr/…` les dédoublerait.
 *
 * Accepte aussi une ancre (`/#pain-points`), que la barre de navigation porte :
 * le segment de langue se pose avant le `#`, jamais après.
 */
export function localizedPath(locale: Locale, href: string): string {
  if (locale === DEFAULT_LOCALE) return href;

  const [path, hash] = href.split("#");
  const prefixed = path === "/" ? `/${locale}` : `/${locale}${path}`;
  return hash === undefined ? prefixed : `${prefixed}#${hash}`;
}

/**
 * Les cinq entrées `hreflang` d'une page : les quatre langues plus
 * `x-default`. Chaque version se liste elle-même — un `hreflang` que la page
 * cible ne renvoie pas est purement ignoré, pas dégradé.
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

/** La locale Open Graph de chaque langue, marché principal de Pulpe compris. */
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
  // Le français suisse et le français de France partagent la même page : Pulpe
  // sert les deux marchés, et l'un des deux serait invisible sans cette entrée.
  return locale === DEFAULT_LOCALE ? ["fr_FR", ...others] : others;
}
