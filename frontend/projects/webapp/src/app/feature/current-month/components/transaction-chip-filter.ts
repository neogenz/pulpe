import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import {
  MatChipSelectionChange,
  MatChipsModule,
} from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import type { TransactionKind } from '@pulpe/shared';

export interface TransactionFilters {
  transactionTypes: TransactionKind[];
}

@Component({
  selector: 'pulpe-transaction-chip-filter',
  imports: [MatChipsModule, MatIconModule],
  template: `
    <mat-chip-listbox
      class="filter-chips"
      [multiple]="true"
      aria-label="Filtrer par type de transaction"
    >
      <mat-chip-option
        [selected]="filters().transactionTypes.includes('FIXED_EXPENSE')"
        (selectionChange)="onTransactionTypeToggle('FIXED_EXPENSE', $event)"
      >
        <mat-icon matChipAvatar>payments</mat-icon>
        Dépenses
      </mat-chip-option>
      <mat-chip-option
        [selected]="filters().transactionTypes.includes('INCOME')"
        (selectionChange)="onTransactionTypeToggle('INCOME', $event)"
      >
        <mat-icon matChipAvatar>trending_up</mat-icon>
        Revenus
      </mat-chip-option>
      <mat-chip-option
        [selected]="filters().transactionTypes.includes('SAVINGS_CONTRIBUTION')"
        (selectionChange)="
          onTransactionTypeToggle('SAVINGS_CONTRIBUTION', $event)
        "
      >
        <mat-icon matChipAvatar>savings</mat-icon>
        Épargne
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
