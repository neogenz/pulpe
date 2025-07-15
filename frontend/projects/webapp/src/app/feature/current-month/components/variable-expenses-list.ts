import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from '@angular/core';
import { TransactionsList, TransactionsListConfig } from './transactions-list';
import { Transaction } from '@pulpe/shared';

@Component({
  selector: 'pulpe-variable-expenses-list',
  imports: [TransactionsList],
  template: `
    <pulpe-transactions-list
      [transactions]="transactions()"
      [config]="config()"
      [(selectedTransactions)]="selectedTransactions"
    />
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariableExpensesList {
  transactions = input.required<Transaction[]>();
  selectedTransactions = model<string[]>([]);

  config = computed(
    (): TransactionsListConfig => ({
      title: 'Transactions variables',
      totalAmount: this.transactions().reduce((total, transaction) => {
        switch (transaction.kind) {
          case 'INCOME':
            return total + transaction.amount;
          case 'FIXED_EXPENSE':
            return total - transaction.amount;
          case 'SAVINGS_CONTRIBUTION':
            return total - transaction.amount;
          default:
            return total;
        }
      }, 0),
      emptyStateIcon: 'swap_vert',
      emptyStateTitle: 'Aucune transaction variable',
      emptyStateSubtitle: 'Vos transactions ponctuelles apparaîtront ici',
      selectable: true,
      defaultExpanded: true,
    }),
  );
}
