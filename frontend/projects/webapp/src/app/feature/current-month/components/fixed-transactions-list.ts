import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Transaction } from '@pulpe/shared';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'pulpe-fixed-transactions-list',
  imports: [CurrencyPipe],
  template: `
    <div class="flex flex-col gap-4">
      @for (transaction of transactions(); track transaction.id) {
        <div class="flex items-center justify-between">
          <span>{{ transaction.description }}</span>
          <span>{{
            transaction.amount | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH'
          }}</span>
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
export class FixedTransactionsList {
  transactions = input.required<Transaction[]>();
}
