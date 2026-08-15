import { getBrowserLang } from '@jsverse/transloco';
import {
  DEFAULT_LOCALE,
  supportedLocaleSchema,
  type SupportedLocale,
} from 'pulpe-shared';
import type { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { readPersistedLocale } from '../user-settings/locale-snapshot';

/**
 * The language the app starts in, resolved before the first paint.
 *
 * Order matters: an explicit app choice outranks a landing CTA, which outranks
 * the browser, which outranks French. Reading the snapshot first is also what
 * keeps a chosen language across a cold start, since the settings API answers
 * much later.
 *
 * The allowlist comes from `supportedLocaleSchema` rather than
 * `TranslocoService.isLang()`: it is the same list — `availableLangs` is built
 * from it — one hop earlier, and it keeps this function out of the DI graph.
 * `LOCALE_ID` resolves through it, and `LOCALE_ID` must not depend on a
 * service that could itself want a locale.
 */
export function resolveStartupLanguage(
  storage: StorageService,
  search = typeof location === 'undefined' ? '' : location.search,
): SupportedLocale {
  const persisted = readPersistedLocale(storage);
  if (persisted) return persisted;

  const incoming = supportedLocaleSchema.safeParse(
    new URLSearchParams(search).get('lang'),
  );
  if (incoming.success) {
    storage.setString(STORAGE_KEYS.SETTINGS_LANGUAGE, incoming.data);
    return incoming.data;
  }

  // `getBrowserLang()` returns the short code, so a `de-CH` browser gives `de`.
  // Outside a browser it returns undefined, which the schema rejects like any
  // other unsupported value.
  const browser = supportedLocaleSchema.safeParse(getBrowserLang());
  return browser.success ? browser.data : DEFAULT_LOCALE;
}
