import { DEFAULT_LOCALE, type SupportedLocale } from 'pulpe-shared';
import { STORAGE_KEYS } from '../storage/storage-keys';
import type { StorageService } from '../storage/storage.service';

export { DEFAULT_LOCALE };

/**
 * Reads the device-persisted language snapshot written by `UserSettingsStore`.
 * Mirrors `readPersistedCurrency`: the app initializer and the `LOCALE_ID`
 * factory both run before the settings API resolves, and both need a language.
 *
 * Returns null when nothing is stored, which is what lets the resolver fall
 * through to the browser language instead of pinning French on a first visit.
 * Validation is delegated to the `supportedLocaleSchema` registered in
 * STORAGE_SCHEMAS — invalid values come back as null too.
 */
export function readPersistedLocale(
  storage: StorageService,
): SupportedLocale | null {
  return storage.get<SupportedLocale>(STORAGE_KEYS.SETTINGS_LANGUAGE);
}
