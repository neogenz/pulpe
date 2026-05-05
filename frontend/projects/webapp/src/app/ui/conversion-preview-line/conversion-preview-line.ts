import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CURRENCY_METADATA,
  getCurrencyFormatter,
  type SupportedCurrency,
} from 'pulpe-shared';

/**
 * Live status of the preview — duplicated from `@core/currency`'s
 * `LivePreviewStatus` on purpose: `ui/` cannot import from `@core/`.
 * A 5-literal string union is cheaper to keep in sync than violating
 * the layer boundary.
 */
export type ConversionPreviewStatus =
  | 'hidden'
  | 'loading'
  | 'ready'
  | 'fallback'
  | 'error';

const RATE_MIN_FRACTION_DIGITS = 2;
const RATE_MAX_FRACTION_DIGITS = 4;

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const rateFormatterCache = new Map<string, Intl.NumberFormat>();

function getDateFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = dateFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
    });
    dateFormatterCache.set(locale, formatter);
  }
  return formatter;
}

function getRateFormatter(locale: string): Intl.NumberFormat {
  let formatter = rateFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: RATE_MIN_FRACTION_DIGITS,
      maximumFractionDigits: RATE_MAX_FRACTION_DIGITS,
    });
    rateFormatterCache.set(locale, formatter);
  }
  return formatter;
}

/**
 * Inline caption rendered under an amount input to show what the value
 * becomes once converted into the user's display currency.
 *
 * Pure presentation: no service injection, no fetch. The parent dialog
 * drives everything through the `injectLiveConversionPreview()` helper.
 */
@Component({
  selector: 'pulpe-conversion-preview-line',
  imports: [MatProgressSpinnerModule, TranslocoPipe],
  template: `
    @if (isVisible()) {
      <div
        role="status"
        aria-live="polite"
        [attr.aria-label]="ariaLabel()"
        data-testid="conversion-preview-line"
        class="flex flex-wrap items-center gap-x-2 gap-y-0 px-4 pt-1 text-label-small text-on-surface-variant ph-no-capture"
      >
        @switch (status()) {
          @case ('loading') {
            <mat-progress-spinner mode="indeterminate" [diameter]="12" />
            <span>{{ 'currency.livePreviewLoading' | transloco }}</span>
          }
          @case ('error') {
            <span data-testid="conversion-preview-error">{{
              'currency.livePreviewError' | transloco
            }}</span>
          }
          @default {
            <span data-testid="conversion-preview-amount">
              {{
                'currency.livePreviewApprox'
                  | transloco
                    : {
                        amount: formattedAmount(),
                        rate: formattedRate(),
                      }
              }}
            </span>
            @if (status() === 'fallback' && formattedDate(); as date) {
              <span
                class="rounded-full bg-pulpe-amber-container px-2 py-0.5 text-pulpe-amber text-label-small"
                data-testid="conversion-preview-fallback-date"
              >
                {{ 'currency.rateFromDate' | transloco: { date } }}
              </span>
            }
          }
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversionPreviewLine {
  readonly amount = input<number | null | undefined>(null);
  readonly inputCurrency = input<SupportedCurrency | null | undefined>(null);
  readonly displayCurrency = input<SupportedCurrency>('CHF');
  readonly rate = input<number | null | undefined>(null);
  readonly cachedDate = input<string | null | undefined>(null);
  readonly status = input<ConversionPreviewStatus>('hidden');

  protected readonly isVisible = computed(() => this.status() !== 'hidden');

  protected readonly formattedAmount = computed(() => {
    const value = this.amount();
    const currency = this.displayCurrency();
    if (value == null) return '';
    return getCurrencyFormatter(currency).format(value);
  });

  protected readonly formattedRate = computed(() => {
    const rate = this.rate();
    if (rate == null) return '';
    const locale = CURRENCY_METADATA[this.displayCurrency()].locale;
    return getRateFormatter(locale).format(rate);
  });

  protected readonly formattedDate = computed(() => {
    const raw = this.cachedDate();
    if (!raw) return '';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    const locale = CURRENCY_METADATA[this.displayCurrency()].locale;
    return getDateFormatter(locale).format(parsed);
  });

  protected readonly ariaLabel = computed(() => this.formattedAmount());
}
