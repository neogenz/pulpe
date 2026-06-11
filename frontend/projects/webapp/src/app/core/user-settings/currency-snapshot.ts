import type { SupportedCurrency } from 'pulpe-shared';
import { STORAGE_KEYS } from '../storage/storage-keys';
import type { StorageService } from '../storage/storage.service';

export const DEFAULT_CURRENCY: SupportedCurrency = 'CHF';

/**
 * Reads the device-persisted currency snapshot written by `UserSettingsStore`.
 * Lets bootstrap-time consumers (LOCALE_ID factory) and the settings-loading
 * window pick the user's formatting locale before the settings API resolves.
 */
export function readPersistedCurrency(
  storage: StorageService,
): SupportedCurrency {
  const persisted = storage.getString(STORAGE_KEYS.SETTINGS_CURRENCY);
  return persisted === 'EUR' || persisted === 'CHF'
    ? persisted
    : DEFAULT_CURRENCY;
}
