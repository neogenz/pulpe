import type { TranslocoService } from '@jsverse/transloco';
import { getCurrencyFormatter } from 'pulpe-shared';
import { CURRENCY_CONFIG } from '../currency-config';

const rateFormatters = new Map<string, Intl.NumberFormat>();

function getRateFormatter(locale: string): Intl.NumberFormat {
  let fmt = rateFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
    rateFormatters.set(locale, fmt);
  }
  return fmt;
}

export function formatConversion(
  transloco: TranslocoService,
  originalAmount: number | null | undefined,
  originalCurrency: string | null | undefined,
  exchangeRate: number | null | undefined,
): string {
  if (originalAmount == null || originalCurrency == null) return '';

  const config =
    CURRENCY_CONFIG[originalCurrency as keyof typeof CURRENCY_CONFIG];
  // Amount and rate share the currency's numberLocale so both numbers use the
  // same decimal separator in one tooltip (CHF → de-CH dot: `1’234.56` / `0.938`).
  const numberLocale = config?.numberLocale ?? 'de-CH';

  const formattedAmount = getCurrencyFormatter(
    originalCurrency,
    numberLocale,
  ).format(originalAmount);

  if (exchangeRate != null) {
    const formattedRate = getRateFormatter(numberLocale).format(exchangeRate);

    return transloco.translate('currency.convertedFromTooltip', {
      amount: formattedAmount,
      rate: formattedRate,
    });
  }

  return transloco.translate('currency.convertedFromTooltipNoRate', {
    amount: formattedAmount,
  });
}
