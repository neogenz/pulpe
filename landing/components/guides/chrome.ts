import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import {
  ADVICE_INDEX_ROUTE,
  ADVICE_LABEL_FR,
  DE_ADVICE_SECTION_PATH,
  localizedPath,
} from "@/lib/routes";

export interface GuideChrome {
  locale: Locale;
  dateLocale: string;
  sectionPath: string;
  backHref: string;
  backLabel: string;
  publishedPrefix: string;
  updatedPrefix: string;
  readingTime: (minutes: number) => string;
  faqHeading: string;
  relatedHeading: string;
  ctaLead: string;
  ctaButton: string;
  inLanguage: string;
  ogLocale: string;
  alternateLocale?: readonly string[];
}

export const FR_GUIDE_CHROME: GuideChrome = {
  locale: DEFAULT_LOCALE,
  dateLocale: "fr-CH",
  sectionPath: ADVICE_INDEX_ROUTE,
  backHref: ADVICE_INDEX_ROUTE,
  backLabel: ADVICE_LABEL_FR,
  publishedPrefix: "Publié le",
  updatedPrefix: "Mis à jour le",
  readingTime: (minutes) => `${minutes} min de lecture`,
  faqHeading: "Questions fréquentes",
  relatedHeading: "Continue avec…",
  ctaLead: "Envie de voir combien il te restera chaque mois\u00a0?",
  ctaButton: "Créer mon budget gratuitement",
  inLanguage: "fr-CH",
  ogLocale: "fr_CH",
  alternateLocale: ["fr_FR"],
};

export const DE_GUIDE_CHROME: GuideChrome = {
  locale: "de",
  dateLocale: "de-CH",
  sectionPath: DE_ADVICE_SECTION_PATH,
  backHref: localizedPath("de", "/"),
  backLabel: "Startseite",
  publishedPrefix: "Veröffentlicht am",
  updatedPrefix: "Aktualisiert am",
  readingTime: (minutes) => `${minutes} Min. Lesezeit`,
  faqHeading: "Häufige Fragen",
  relatedHeading: "Weiterlesen",
  ctaLead: "Willst du sehen, wie viel dir jeden Monat bleibt?",
  ctaButton: "Budget kostenlos erstellen",
  inLanguage: "de-CH",
  ogLocale: "de_CH",
};
