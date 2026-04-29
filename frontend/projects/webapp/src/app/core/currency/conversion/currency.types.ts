import { type SupportedCurrency } from 'pulpe-shared';

export interface FetchRateResult {
  rate: number;
  /** True when the live fetch failed and we returned a stale cache entry. */
  fromFallback?: boolean;
  /** ISO date (YYYY-MM-DD) associated with the returned rate, from the API. */
  cachedDate?: string;
}

export interface CurrencyMetadata {
  originalAmount: number;
  originalCurrency: SupportedCurrency;
  targetCurrency: SupportedCurrency;
  exchangeRate: number;
}

export interface CurrencyConversionResult {
  convertedAmount: number;
  metadata: CurrencyMetadata | null;
}
