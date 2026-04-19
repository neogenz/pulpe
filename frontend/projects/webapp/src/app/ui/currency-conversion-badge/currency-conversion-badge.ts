import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { CURRENCY_METADATA } from 'pulpe-shared';

const formatterCache = new Map<string, Intl.NumberFormat>();

function getAmountFormatter(
  locale: string,
  currency: string,
): Intl.NumberFormat {
  const key = `${locale}_${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

@Component({
  selector: 'pulpe-currency-conversion-badge',
  imports: [MatIconModule, MatTooltipModule, TranslocoPipe],
  template: `
    @if (hasConversion()) {
      <span
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-label-small cursor-help align-middle"
        [matTooltip]="tooltipText()"
        matTooltipClass="whitespace-pre-line"
        matTooltipTouchGestures="on"
        [attr.aria-label]="
          'currency.convertedFromAriaLabel'
            | transloco: { amount: formattedOriginalAmount() }
        "
        role="note"
        tabindex="0"
      >
        <mat-icon class="!text-sm !w-4 !h-4 leading-none"
          >currency_exchange</mat-icon
        >
        <span class="ph-no-capture">{{
          'currency.convertedFromInline'
            | transloco: { amount: formattedOriginalAmount() }
        }}</span>
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyConversionBadge {
  readonly originalAmount = input<number | null | undefined>(null);
  readonly originalCurrency = input<string | null | undefined>(null);
  readonly exchangeRate = input<number | null | undefined>(null);
  readonly tooltipText = input<string>('');

  protected readonly hasConversion = computed(
    () => this.originalAmount() != null && this.originalCurrency() != null,
  );

  protected readonly formattedOriginalAmount = computed(() => {
    const amount = this.originalAmount();
    const currency = this.originalCurrency();
    if (amount == null || !currency) return '';
    const config =
      CURRENCY_METADATA[currency as keyof typeof CURRENCY_METADATA];
    const locale = config?.locale ?? 'fr-CH';
    return getAmountFormatter(locale, currency).format(amount);
  });
}
