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

  config = computed(
    (): TransactionsListConfig => ({
      title: 'Transactions fixes',
      totalAmount: this.transactions().reduce((total, transaction) => {
        switch (transaction.kind) {
          case 'income':
            return total + transaction.amount;
          case 'expense':
            return total - transaction.amount;
          case 'saving':
            return total - transaction.amount;
          default:
            return total;
        }
      }, 0),
      emptyStateIcon: 'event_repeat',
      emptyStateTitle: 'Aucune transaction fixe',
      emptyStateSubtitle: 'Vos transactions récurrentes apparaîtront ici',
      defaultExpanded: false,
    }),
  );
}
