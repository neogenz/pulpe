import { I18n, type TranslateOptions } from "i18n-js";
import { DEFAULT_LOCALE } from "pulpe-shared";

import de from "./catalogs/de.json";
import en from "./catalogs/en.json";
import fr from "./catalogs/fr.json";
import it from "./catalogs/it.json";

export const i18n = new I18n({ de, en, fr, it });
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.enableFallback = true;
i18n.locale = DEFAULT_LOCALE;

export function translate(key: string, options?: TranslateOptions): string {
  return i18n.t(key, options);
}
