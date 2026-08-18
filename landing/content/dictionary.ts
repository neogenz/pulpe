import type { Locale } from "@/lib/i18n";

/**
 * Le catalogue français est la source : les trois autres sont typés contre lui,
 * donc une clé manquante est une erreur de compilation et non un trou à
 * l'écran. `import type` suffit ici — rien de `fr.ts` n'arrive à l'exécution
 * par ce chemin, les catalogues restent chargés un par un ci-dessous.
 */
export type Dictionary = typeof import("./dictionaries/fr").default;

// Pas de `import "server-only"` ici : `scripts/generate-og-image.ts` appelle
// `getDictionary` depuis Node, hors de Next, et le garde y jetterait.
//
// Un import dynamique par langue, et non un baril : l'export statique rend les
// quatre langues au build, mais rien ne doit obliger un seul rendu à charger
// les quatre catalogues.
const LOADERS: Record<Locale, () => Promise<{ default: Dictionary }>> = {
  fr: () => import("./dictionaries/fr"),
  en: () => import("./dictionaries/en"),
  de: () => import("./dictionaries/de"),
  it: () => import("./dictionaries/it"),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const catalog = await LOADERS[locale]();
  return catalog.default;
}
