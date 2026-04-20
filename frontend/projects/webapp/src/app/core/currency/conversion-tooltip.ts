import type { TranslocoService } from '@jsverse/transloco';
import { getCurrencyFormatter } from 'pulpe-shared';
import { CURRENCY_CONFIG } from './currency-config';

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

export function buildConversionTooltip(
  transloco: TranslocoService,
  originalAmount: number | null | undefined,
  originalCurrency: string | null | undefined,
  exchangeRate: number | null | undefined,
): string {
  if (originalAmount == null || originalCurrency == null) return '';

  const config =
    CURRENCY_CONFIG[originalCurrency as keyof typeof CURRENCY_CONFIG];
  const locale = config?.locale ?? 'fr-CH';

  const formattedAmount = getCurrencyFormatter(originalCurrency, locale).format(
    originalAmount,
  );

  if (exchangeRate != null) {
    const formattedRate = getRateFormatter(locale).format(exchangeRate);

    return transloco.translate('currency.convertedFromTooltip', {
      amount: formattedAmount,
      rate: formattedRate,
    });
  }

  return transloco.translate('currency.convertedFromTooltipNoRate', {
    amount: formattedAmount,
  });
}
