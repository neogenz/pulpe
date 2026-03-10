import type { TranslocoService } from '@jsverse/transloco';
import { CURRENCY_CONFIG } from './currency-config';

export function buildConversionTooltip(
  transloco: TranslocoService,
  originalAmount: number | null | undefined,
  originalCurrency: string | null | undefined,
  exchangeRate: number | null | undefined,
): string {
  if (originalAmount == null || originalCurrency == null) return '';

  const config =
    CURRENCY_CONFIG[originalCurrency as keyof typeof CURRENCY_CONFIG];
  const locale = config?.locale ?? 'de-CH';

  const formattedAmount = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: originalCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(originalAmount);

  if (exchangeRate != null) {
    const formattedRate = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(exchangeRate);

    return transloco.translate('currency.conversionTooltip', {
      amount: formattedAmount,
      rate: formattedRate,
    });
  }

  return transloco.translate('currency.conversionTooltipNoRate', {
    amount: formattedAmount,
  });
}
