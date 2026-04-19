import type { SupportedCurrency } from '../schemas.js';

/**
 * Display metadata for each supported currency.
 *
 * Lives in `pulpe-shared` (not in webapp's `core/currency/`) so that the
 * frontend `ui/` layer can import it without crossing the architectural
 * boundary that forbids `ui/` → `core/` dependencies.
 */
export interface CurrencyMetadataEntry {
  /** BCP 47 locale used for number formatting (e.g. fr-CH for CHF). */
  locale: string;
  /** Display symbol — `CHF` keeps the code, `€` for EUR. */
  symbol: string;
  /** Country/region flag emoji rendered in pickers and chips. */
  flag: string;
  /** Native French display name shown next to the code. */
  nativeName: string;
}

export const CURRENCY_METADATA: Record<
  SupportedCurrency,
  CurrencyMetadataEntry
> = {
  CHF: {
    locale: 'fr-CH',
    symbol: 'CHF',
    flag: '🇨🇭',
    nativeName: 'Franc suisse',
  },
  EUR: {
    locale: 'fr-FR',
    symbol: '€',
    flag: '🇪🇺',
    nativeName: 'Euro',
  },
};
