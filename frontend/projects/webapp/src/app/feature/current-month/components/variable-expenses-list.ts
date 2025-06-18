import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
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
    />
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariableExpensesList {
  transactions = input.required<Transaction[]>();

  config = computed(
    (): TransactionsListConfig => ({
      title: 'Transactions variables',
      emptyStateIcon: 'swap_vert',
      emptyStateTitle: 'Aucune transaction variable',
      emptyStateSubtitle: 'Vos transactions ponctuelles apparaîtront ici',
    }),
  );
}
