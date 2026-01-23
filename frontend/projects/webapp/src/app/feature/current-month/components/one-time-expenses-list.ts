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
  readonly financialEntries = input.required<FinancialEntryModel[]>();
  readonly selectedFinancialEntries = model<string[]>([]);
  readonly deleteFinancialEntry = output<string>();
  readonly editFinancialEntry = output<string>();
  readonly toggleCheckFinancialEntry = output<string>();
  readonly #breakpointObserver = inject(BreakpointObserver);

  protected readonly isHandset = toSignal(
    this.#breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay(),
    ),
    { initialValue: false },
  );
  readonly config = computed(
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
      emptyStateTitle: 'Pas de transaction ce mois-ci',
      emptyStateSubtitle: "Ajoute tes dépenses au fil de l'eau",
      selectable: false,
      deletable: true,
      editable: true,
      defaultExpanded: true,
    }),
  );
}
