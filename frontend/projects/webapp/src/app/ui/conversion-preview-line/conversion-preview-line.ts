import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { getCurrencyFormatter, type SupportedCurrency } from 'pulpe-shared';

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

const FALLBACK_DATE_LOCALE = 'fr-CH';
const FALLBACK_DATE_FORMATTER = new Intl.DateTimeFormat(FALLBACK_DATE_LOCALE, {
  day: '2-digit',
  month: 'short',
});

const RATE_FORMATTER = new Intl.NumberFormat(FALLBACK_DATE_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

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
    <div
      role="status"
      aria-live="polite"
      [attr.aria-label]="ariaLabel()"
      data-testid="conversion-preview-line"
    >
      @if (isVisible()) {
        <div
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
    </div>
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
    return rate == null ? '' : RATE_FORMATTER.format(rate);
  });

  protected readonly formattedDate = computed(() => {
    const raw = this.cachedDate();
    if (!raw) return '';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return FALLBACK_DATE_FORMATTER.format(parsed);
  });

  protected readonly ariaLabel = computed(() => this.formattedAmount());
}
