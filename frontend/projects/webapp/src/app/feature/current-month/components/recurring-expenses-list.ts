import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import {
  FinancialAccordion,
  type FinancialAccordionConfig,
} from './financial-accordion';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { shareReplay } from 'rxjs';
import { type FinancialEntryModel } from '../models/financial-entry.model';

@Component({
  selector: 'pulpe-recurring-expenses-list',
  imports: [FinancialAccordion],
  template: `
    <pulpe-financial-accordion
      [financialEntries]="financialEntries()"
      [config]="config()"
      (toggleCheckFinancialEntry)="toggleCheckFinancialEntry.emit($event)"
      [isHandset]="isHandset()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringExpensesList {
  readonly breakpointObserver = inject(BreakpointObserver);

  financialEntries = input.required<FinancialEntryModel[]>();
  readonly toggleCheckFinancialEntry = output<string>();

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
      totalAmount: this.financialEntries().reduce((total, financialEntry) => {
        switch (financialEntry.kind) {
          case 'income':
            return total + financialEntry.amount;
          case 'expense':
            return total - financialEntry.amount;
          case 'saving':
            return total - financialEntry.amount;
          default:
            return total;
        }
      }, 0),
      emptyStateIcon: 'event_repeat',
      emptyStateTitle: 'Aucune prévision récurrente pour l\'instant',
      emptyStateSubtitle: 'Tes charges fixes et revenus réguliers apparaîtront ici',
      defaultExpanded: false,
    }),
  );
}
