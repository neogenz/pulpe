import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

const LOCALE_MAP: Record<string, string> = {
  CHF: 'de-CH',
  EUR: 'de-DE',
};

@Component({
  selector: 'pulpe-currency-conversion-badge',
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (hasConversion()) {
      <mat-icon
        [matTooltip]="tooltipText()"
        matTooltipClass="whitespace-pre-line"
        class="!text-base text-on-surface-variant inline-flex align-middle cursor-help"
        >currency_exchange</mat-icon
      >
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

  protected readonly hasConversion = computed(
    () => this.originalAmount() != null && this.originalCurrency() != null,
  );

  protected readonly tooltipText = computed(() => {
    const amount = this.originalAmount();
    const currency = this.originalCurrency();
    const rate = this.exchangeRate();

    if (amount == null || currency == null) return '';

    const locale = LOCALE_MAP[currency] ?? 'de-CH';
    const formattedAmount = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    const parts = [`Converti depuis ${formattedAmount}`];
    if (rate != null) {
      const formattedRate = new Intl.NumberFormat('de-CH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(rate);
      parts.push(`Taux : ${formattedRate}`);
    }

    return parts.join('\n');
  });
}
