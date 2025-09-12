import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { type Transaction } from '@pulpe/shared';
import {
  FinancialAccordion,
  type FinancialAccordionConfig,
} from './financial-accordion';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { shareReplay } from 'rxjs';

@Component({
  selector: 'pulpe-recurring-expenses-list',
  imports: [FinancialAccordion],
  template: `
    <pulpe-financial-accordion
      [transactions]="transactions()"
      [config]="config()"
      [isHandset]="isHandset()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringExpensesList {
  readonly breakpointObserver = inject(BreakpointObserver);

  transactions = input.required<Transaction[]>();

  protected readonly isHandset = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay(),
    ),
    { initialValue: false },
  );

  config = computed(
    (): FinancialAccordionConfig => ({
      title: 'Récurrentes',
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
