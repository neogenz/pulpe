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
import { BreakpointObserver } from '@angular/cdk/layout';
import { Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { shareReplay } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FinancialEntryModel } from '../models/financial-entry.model';

@Component({
  selector: 'pulpe-one-time-expenses-list',
  imports: [FinancialAccordion],
  template: `
    <pulpe-financial-accordion
      [financialEntries]="financialEntries()"
      [config]="config()"
      [(selectedFinancialEntries)]="selectedFinancialEntries"
      (deleteFinancialEntry)="deleteFinancialEntry.emit($event)"
      (editFinancialEntry)="editFinancialEntry.emit($event)"
      (toggleCheckFinancialEntry)="toggleCheckFinancialEntry.emit($event)"
      [isHandset]="isHandset()"
    />
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OneTimeExpensesList {
  financialEntries = input.required<FinancialEntryModel[]>();
  selectedFinancialEntries = model<string[]>([]);
  deleteFinancialEntry = output<string>();
  editFinancialEntry = output<string>();
  toggleCheckFinancialEntry = output<string>();
  readonly #breakpointObserver = inject(BreakpointObserver);

  protected readonly isHandset = toSignal(
    this.#breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay(),
    ),
    { initialValue: false },
  );
  config = computed(
    (): FinancialAccordionConfig => ({
      title: 'Ponctuelles',
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
      emptyStateIcon: 'swap_vert',
      emptyStateTitle: 'Aucune transaction ponctuelle',
      emptyStateSubtitle: 'Vos transactions ponctuelles apparaîtront ici',
      selectable: false,
      deletable: true,
      editable: true,
      defaultExpanded: true,
    }),
  );
}
