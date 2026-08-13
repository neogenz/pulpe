import type { SupportedLocale } from '../schemas.js';

/** The language Pulpe falls back to for any missing key, on every platform. */
export const DEFAULT_LOCALE: SupportedLocale = 'fr';

export interface LocaleMetadataEntry {
  /**
   * The language written in itself — a French speaker looking for their
   * language scans for `Français`, not for `French`. Unlike
   * `CURRENCY_METADATA.nativeName`, which holds French labels and leaks them
   * onto every screen that renders it, nothing here is ever translated: these
   * four strings are identical in all four catalogs.
   */
  nativeName: string;
}

export const LOCALE_METADATA: Record<SupportedLocale, LocaleMetadataEntry> = {
  fr: { nativeName: 'Français' },
  en: { nativeName: 'English' },
  de: { nativeName: 'Deutsch' },
  it: { nativeName: 'Italiano' },
};
