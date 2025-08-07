import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
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
      [loadingTransactionIds]="loadingTransactionIds()"
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
  loadingTransactionIds = input<string[]>([]);
  deleteTransaction = output<string>();

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
      deletable: true,
      defaultExpanded: true,
    }),
  );
}
