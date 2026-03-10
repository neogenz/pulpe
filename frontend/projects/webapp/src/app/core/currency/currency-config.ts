import type { SupportedCurrency } from 'pulpe-shared';

export const CURRENCY_CONFIG: Record<
  SupportedCurrency,
  { locale: string; symbol: string }
> = {
  CHF: { locale: 'de-CH', symbol: 'CHF' },
  EUR: { locale: 'de-DE', symbol: '€' },
};

export const DEFAULT_DIGITS_INFO = '1.2-2';
