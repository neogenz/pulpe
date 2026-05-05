import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { getCurrencyFormatter } from 'pulpe-shared';

const FALLBACK_DATE_LOCALE = 'fr-CH';

const fallbackDateFormatter = new Intl.DateTimeFormat(FALLBACK_DATE_LOCALE, {
  day: '2-digit',
  month: 'short',
});

@Component({
  selector: 'pulpe-currency-conversion-badge',
  imports: [MatIconModule, MatTooltipModule, TranslocoPipe],
  template: `
    @if (isFallbackMode()) {
      <span
        class="badge badge-fallback"
        [matTooltip]="
          fallbackTooltipText() || ('currency.fallbackTooltip' | transloco)
        "
        matTooltipClass="whitespace-pre-line"
        matTooltipTouchGestures="on"
        [attr.aria-label]="
          'currency.rateFromDateAriaLabel'
            | transloco: { date: formattedFallbackDate() }
        "
        role="note"
        tabindex="0"
        data-testid="currency-conversion-badge-fallback"
      >
        <mat-icon class="!text-sm !w-4 !h-4 leading-none">cloud_off</mat-icon>
        <span>{{
          'currency.rateFromDate' | transloco: { date: formattedFallbackDate() }
        }}</span>
      </span>
    } @else if (hasHistoricalConversion()) {
      <span
        class="badge badge-historical"
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

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: var(--mat-sys-label-small-size);
      line-height: var(--mat-sys-label-small-line-height);
      cursor: help;
      vertical-align: middle;
    }

    .badge-historical {
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
    }

    .badge-fallback {
      background: var(--pulpe-amber-container);
      color: var(--pulpe-amber);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyConversionBadge {
  readonly originalAmount = input<number | null | undefined>(null);
  readonly originalCurrency = input<string | null | undefined>(null);
  readonly exchangeRate = input<number | null | undefined>(null);
  readonly tooltipText = input<string>('');

  /**
   * Fallback mode — set when the live FX fetch failed and the UI is
   * displaying the last cached rate. Pass the ISO date (YYYY-MM-DD) of
   * the cached rate; the badge formats it as "dd MMM" in fr-CH.
   */
  readonly fallbackDate = input<string | null | undefined>(null);
  readonly fallbackTooltipText = input<string>('');

  protected readonly isFallbackMode = computed(() => {
    const date = this.fallbackDate();
    return date != null && date !== '';
  });

  protected readonly hasHistoricalConversion = computed(
    () => this.originalAmount() != null && this.originalCurrency() != null,
  );

  protected readonly formattedFallbackDate = computed(() => {
    const raw = this.fallbackDate();
    if (!raw) return '';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return fallbackDateFormatter.format(parsed);
  });

  protected readonly formattedOriginalAmount = computed(() => {
    const amount = this.originalAmount();
    const currency = this.originalCurrency();
    if (amount == null || !currency) return '';
    return getCurrencyFormatter(currency).format(amount);
  });
}
