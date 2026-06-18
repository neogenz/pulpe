import type { SupportedCurrency } from 'pulpe-shared';
import { STORAGE_KEYS } from '../storage/storage-keys';
import type { StorageService } from '../storage/storage.service';

export const DEFAULT_CURRENCY: SupportedCurrency = 'CHF';

/**
 * Reads the device-persisted currency snapshot written by `UserSettingsStore`.
 * Lets bootstrap-time consumers (LOCALE_ID factory) and the settings-loading
 * window pick the user's formatting locale before the settings API resolves.
 * Validation is delegated to the `supportedCurrencySchema` registered in
 * STORAGE_SCHEMAS — invalid values come back as null.
 */
export function readPersistedCurrency(
  storage: StorageService,
): SupportedCurrency {
  return (
    storage.get<SupportedCurrency>(STORAGE_KEYS.SETTINGS_CURRENCY) ??
    DEFAULT_CURRENCY
  );
}
