import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { getCurrencyFormatter, type SupportedCurrency } from 'pulpe-shared';

/**
 * Secondary caption shown under a primary amount when the value was captured
 * in a different currency. iOS parity (`TransactionAmountView`): the caption
 * is always rendered once a conversion is in history; only the interactive
 * tooltip surface (rate + "taux figé") is opt-in via `tooltipText`.
 */
@Component({
  selector: 'pulpe-original-amount-line',
  imports: [MatTooltipModule, TranslocoPipe],
  template: `
    @if (formattedAmount(); as amount) {
      <span
        class="block text-label-small text-on-surface-variant ph-no-capture"
        [class.cursor-help]="tooltipText()"
        [matTooltip]="tooltipText()"
        matTooltipClass="whitespace-pre-line"
        matTooltipTouchGestures="on"
        [attr.role]="tooltipText() ? 'note' : null"
        [attr.tabindex]="tooltipText() ? 0 : null"
        [attr.aria-label]="
          'currency.originalAmountLabel' | transloco: { amount }
        "
        data-testid="original-amount-line"
      >
        {{ amount }}
      </span>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OriginalAmountLine {
  readonly originalAmount = input<number | null | undefined>(null);
  readonly originalCurrency = input<SupportedCurrency | null | undefined>(null);
  readonly displayCurrency = input<SupportedCurrency>('CHF');
  readonly tooltipText = input<string>('');

  protected readonly formattedAmount = computed<string | null>(() => {
    const amount = this.originalAmount();
    const currency = this.originalCurrency();
    const display = this.displayCurrency();
    if (amount == null || !currency || currency === display) return null;
    return getCurrencyFormatter(currency).format(amount);
  });
}
