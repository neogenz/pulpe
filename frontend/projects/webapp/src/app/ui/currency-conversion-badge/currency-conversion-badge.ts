import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'pulpe-currency-conversion-badge',
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (hasConversion()) {
      <mat-icon
        [matTooltip]="tooltipText()"
        matTooltipClass="whitespace-pre-line"
        [attr.aria-label]="tooltipText()"
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
  readonly tooltipText = input<string>('');

  protected readonly hasConversion = computed(
    () => this.originalAmount() != null && this.originalCurrency() != null,
  );
}
