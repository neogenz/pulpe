import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import {
  FinancialAccordion,
  type FinancialAccordionConfig,
} from './financial-accordion';
import { type Transaction } from '@pulpe/shared';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { shareReplay } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'pulpe-one-time-expenses-list',
  imports: [FinancialAccordion],
  template: `
    <pulpe-financial-accordion
      [transactions]="transactions()"
      [config]="config()"
      [(selectedTransactions)]="selectedTransactions"
      (deleteTransaction)="deleteTransaction.emit($event)"
      (editTransaction)="editTransaction.emit($event)"
      [isHandset]="isHandset()"
    />
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OneTimeExpensesList {
  transactions = input.required<Transaction[]>();
  selectedTransactions = model<string[]>([]);
  deleteTransaction = output<string>();
  editTransaction = output<string>();
  readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly isHandset = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay(),
    ),
    { initialValue: false },
  );
  config = computed(
    (): FinancialAccordionConfig => ({
      title: 'Ponctuelles',
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
      editable: true,
      defaultExpanded: true,
    }),
  );
}
