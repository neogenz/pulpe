import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { type SupportedCurrency, SUPPORTED_CURRENCIES } from 'pulpe-shared';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'pulpe-currency-suffix',
  imports: [MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showSelector()) {
      <mat-select
        [value]="currency()"
        (selectionChange)="currencyChange.emit($event.value)"
        class="!w-[70px] text-on-surface-variant font-medium"
        aria-label="Devise"
      >
        @for (c of currencies; track c) {
          <mat-option [value]="c">{{ c }}</mat-option>
        }
      </mat-select>
    } @else {
      <span class="text-on-surface-variant font-medium">{{ currency() }}</span>
    }
  `,
})
export class CurrencySuffix {
  readonly showSelector = input(false);
  readonly currency = input<SupportedCurrency>('CHF');
  readonly currencyChange = output<SupportedCurrency>();
  protected readonly currencies = SUPPORTED_CURRENCIES;
}
