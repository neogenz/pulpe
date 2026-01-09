import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import {
  type MatChipSelectionChange,
  MatChipsModule,
} from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import type { TransactionKind } from 'pulpe-shared';
import { TransactionLabelPipe } from '@ui/transaction-display';

export interface TransactionFilters {
  transactionTypes: TransactionKind[];
}

@Component({
  selector: 'pulpe-transaction-chip-filter',
  imports: [MatChipsModule, MatIconModule, TransactionLabelPipe],
  template: `
    <mat-chip-listbox
      class="filter-chips"
      [multiple]="true"
      aria-label="Filtrer par type de transaction"
    >
      <mat-chip-option
        [selected]="filters().transactionTypes.includes('expense')"
        (selectionChange)="onTransactionTypeToggle('expense', $event)"
      >
        <mat-icon matChipAvatar>payments</mat-icon>
        {{ 'expense' | transactionLabel }}s
      </mat-chip-option>
      <mat-chip-option
        [selected]="filters().transactionTypes.includes('income')"
        (selectionChange)="onTransactionTypeToggle('income', $event)"
      >
        <mat-icon matChipAvatar>arrow_upward</mat-icon>
        {{ 'income' | transactionLabel }}s
      </mat-chip-option>
      <mat-chip-option
        [selected]="filters().transactionTypes.includes('saving')"
        (selectionChange)="onTransactionTypeToggle('saving', $event)"
      >
        <mat-icon matChipAvatar>savings</mat-icon>
        {{ 'saving' | transactionLabel }}
      </mat-chip-option>
    </mat-chip-listbox>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionChipFilter {
  filters = model<TransactionFilters>({
    transactionTypes: [],
  });

  onTransactionTypeToggle(
    type: TransactionKind,
    event: MatChipSelectionChange,
  ): void {
    if (!event.isUserInput) {
      return;
    }

    const currentFilters = this.filters();
    const transactionTypes = event.selected
      ? [...currentFilters.transactionTypes, type]
      : currentFilters.transactionTypes.filter(
          (t: TransactionKind) => t !== type,
        );

    this.filters.set({ transactionTypes });
  }
}
