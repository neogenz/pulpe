import { CURRENCY_METADATA, type CurrencyMetadataEntry } from 'pulpe-shared';

/**
 * Re-export of the shared currency display metadata under the legacy
 * `CURRENCY_CONFIG` name used by `core/`, `feature/`, and `pattern/` layers.
 *
 * The `ui/` layer cannot import from `@core/currency` (boundary rule), so it
 * imports `CURRENCY_METADATA` directly from `pulpe-shared` instead.
 */
export const CURRENCY_CONFIG = CURRENCY_METADATA;
export type CurrencyConfigEntry = CurrencyMetadataEntry;

export const DEFAULT_DIGITS_INFO = '1.2-2';
