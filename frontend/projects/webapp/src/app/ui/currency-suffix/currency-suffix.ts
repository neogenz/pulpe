import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import {
  CURRENCY_METADATA,
  type SupportedCurrency,
  SUPPORTED_CURRENCIES,
} from 'pulpe-shared';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-currency-suffix',
  imports: [MatSelectModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showSelector()) {
      <mat-select
        [value]="currency()"
        [disabled]="disabled()"
        (selectionChange)="currencyChange.emit($event.value)"
        class="!w-[70px] text-on-surface-variant font-medium"
        [attr.aria-label]="'common.currencySelector' | transloco"
      >
        @for (c of currencies; track c) {
          <mat-option [value]="c">
            <span class="mr-1">{{ CURRENCY_METADATA[c].flag }}</span
            >{{ c }}
          </mat-option>
        }
      </mat-select>
    } @else {
      <span class="text-on-surface-variant font-medium">{{ currency() }}</span>
    }
  `,
})
export class CurrencySuffix {
  readonly showSelector = input(false);
  readonly disabled = input(false);
  readonly currency = input<SupportedCurrency>('CHF');
  readonly currencyChange = output<SupportedCurrency>();
  protected readonly currencies = SUPPORTED_CURRENCIES;
  protected readonly CURRENCY_METADATA = CURRENCY_METADATA;
}
