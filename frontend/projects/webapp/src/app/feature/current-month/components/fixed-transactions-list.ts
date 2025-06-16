import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { Transaction } from '@pulpe/shared';
import { TransactionsList, TransactionsListConfig } from './transactions-list';

@Component({
  selector: 'pulpe-fixed-transactions-list',
  imports: [TransactionsList],
  template: `
    <pulpe-transactions-list
      [transactions]="transactions()"
      [config]="config()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FixedTransactionsList {
  transactions = input.required<Transaction[]>();

  config = computed((): TransactionsListConfig => ({
    title: 'Dépenses fixes',
    emptyStateIcon: 'trending_down',
    emptyStateTitle: 'Aucune dépense fixe',
    emptyStateSubtitle: 'Vos dépenses fixes apparaîtront ici'
  }));

  test = computed(() => [
    ...this.transactions(),
    ...this.transactions(),
    ...this.transactions(),
    ...this.transactions(),
    ...this.transactions(),
    ...this.transactions(),
  ]);
}
