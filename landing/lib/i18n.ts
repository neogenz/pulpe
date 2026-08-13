// Les quatre langues sont déclarées ici et non importées de `pulpe-shared` :
// ce paquet expose ses constantes derrière un baril qui charge Zod, et la
// landing est un export statique sans aucune autre dépendance de l'atelier.
// `docs/I18N.md` porte la duplication ; ajouter une langue touche de toute
// façon les quatre plateformes le même jour.
export const DEFAULT_LOCALE = "fr" as const;

// Les langues servies sous un segment d'URL. Le français reste à la racine :
// toutes ses URL sont déjà indexées, et `/fr/…` les dédoublerait.
export const PREFIXED_LOCALES = ["en", "de", "it"] as const;

export const LOCALES = [DEFAULT_LOCALE, ...PREFIXED_LOCALES] as const;

export type Locale = (typeof LOCALES)[number];
export type PrefixedLocale = (typeof PREFIXED_LOCALES)[number];

/** Le nom de chaque langue écrit dans cette langue, jamais traduit. */
export const LOCALE_NATIVE_NAME: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
  it: "Italiano",
};

/**
 * Le bandeau parle la langue qu'il propose, pas celle de la page : un visiteur
 * allemand qui tombe sur la version française ne lirait pas une phrase
 * française lui expliquant qu'une version allemande existe. Ces trois lignes
 * vivent donc ici et non dans les catalogues, qui sont indexés par la langue de
 * la page.
 */
export const LOCALE_BANNER: Record<
  Locale,
  { message: string; action: string; dismiss: string }
> = {
  fr: {
    message: "Cette page existe en français.",
    action: "Lire en français",
    dismiss: "Fermer",
  },
  en: {
    message: "This page is available in English.",
    action: "Read in English",
    dismiss: "Dismiss",
  },
  de: {
    message: "Diese Seite gibt es auf Deutsch.",
    action: "Auf Deutsch lesen",
    dismiss: "Schließen",
  },
  it: {
    message: "Questa pagina è disponibile in italiano.",
    action: "Leggi in italiano",
    dismiss: "Chiudi",
  },
};

/**
 * La langue du navigateur, ramenée à l'une des quatre. `navigator.language`
 * rend une étiquette complète (`de-AT`, `en-GB`) : seule sa racine compte, les
 * variantes régionales partagent le même catalogue.
 */
export function matchLocale(
  browserLanguage: string | undefined,
): Locale | null {
  const root = browserLanguage?.split("-")[0]?.toLowerCase();
  return LOCALES.find((code) => code === root) ?? null;
}

/**
 * Le segment `[lang]` d'une URL, ramené à une langue connue. Injoignable en
 * pratique : `generateStaticParams` n'émet que les trois langues préfixées, et
 * l'export statique ne rend aucune autre valeur. Ce garde existe pour que le
 * jour où quelqu'un élargit `generateStaticParams`, l'erreur arrive au build.
 */
export function assertPrefixedLocale(segment: string): PrefixedLocale {
  const locale = PREFIXED_LOCALES.find((code) => code === segment);
  if (!locale) {
    throw new Error(
      `Segment de langue inconnu : « ${segment} ». Attendu : ${PREFIXED_LOCALES.join(", ")}.`,
    );
  }
  return locale;
}
