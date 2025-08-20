import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import {
  TransactionsList,
  type TransactionsListConfig,
} from './transactions-list';
import { type Transaction } from '@pulpe/shared';

@Component({
  selector: 'pulpe-variable-expenses-list',
  imports: [TransactionsList],
  template: `
    <pulpe-transactions-list
      [transactions]="transactions()"
      [config]="config()"
      [(selectedTransactions)]="selectedTransactions"
      (deleteTransaction)="deleteTransaction.emit($event)"
    />
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariableExpensesList {
  transactions = input.required<Transaction[]>();
  selectedTransactions = model<string[]>([]);
  deleteTransaction = output<string>();

  config = computed(
    (): TransactionsListConfig => ({
      title: 'Transactions variables',
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
      emptyStateIcon: 'swap_vert',
      emptyStateTitle: 'Aucune transaction variable',
      emptyStateSubtitle: 'Vos transactions ponctuelles apparaîtront ici',
      selectable: true,
      deletable: true,
      defaultExpanded: true,
    }),
  );
}
