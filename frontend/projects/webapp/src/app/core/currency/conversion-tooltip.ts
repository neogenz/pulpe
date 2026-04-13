import type { TranslocoService } from '@jsverse/transloco';
import { CURRENCY_CONFIG } from './currency-config';

const currencyFormatters = new Map<string, Intl.NumberFormat>();
const rateFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(
  locale: string,
  currency: string,
): Intl.NumberFormat {
  const key = `${locale}_${currency}`;
  let fmt = currencyFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(key, fmt);
  }
  return fmt;
}

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

  const formattedAmount = getCurrencyFormatter(locale, originalCurrency).format(
    originalAmount,
  );

  if (exchangeRate != null) {
    const formattedRate = getRateFormatter(locale).format(exchangeRate);

    return transloco.translate('currency.conversionTooltip', {
      amount: formattedAmount,
      rate: formattedRate,
    });
  }

  return transloco.translate('currency.conversionTooltipNoRate', {
    amount: formattedAmount,
  });
}
