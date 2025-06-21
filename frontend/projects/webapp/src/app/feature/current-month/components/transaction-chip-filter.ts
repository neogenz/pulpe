import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import {
  MatChipSelectionChange,
  MatChipsModule,
} from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import type { TransactionType } from '@pulpe/shared';

export interface TransactionFilters {
  transactionTypes: TransactionType[];
}

@Component({
  selector: 'pulpe-transaction-chip-filter',
  imports: [MatChipsModule, MatIconModule],
  template: `
    <mat-chip-set class="filter-chips">
      <mat-chip-option
        [selected]="filters().transactionTypes.includes('expense')"
        (selectionChange)="onTransactionTypeToggle('expense', $event)"
      >
        <mat-icon matChipAvatar>payments</mat-icon>
        Dépenses
      </mat-chip-option>
      <mat-chip-option
        [selected]="filters().transactionTypes.includes('income')"
        (selectionChange)="onTransactionTypeToggle('income', $event)"
      >
        <mat-icon matChipAvatar>trending_up</mat-icon>
        Revenus
      </mat-chip-option>
      <mat-chip-option
        [selected]="filters().transactionTypes.includes('saving')"
        (selectionChange)="onTransactionTypeToggle('saving', $event)"
      >
        <mat-icon matChipAvatar>savings</mat-icon>
        Épargne
      </mat-chip-option>
    </mat-chip-set>
  `,
  styles: `
    :host {
      display: block;
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--mat-sys-spacing-2);
    }

    mat-chip-option {
      --mat-chip-container-height: 40px;
      --mat-chip-label-text-font: var(--mat-sys-label-large);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionChipFilter {
  filters = model<TransactionFilters>({
    transactionTypes: [],
  });

  onTransactionTypeToggle(
    type: TransactionType,
    event: MatChipSelectionChange,
  ): void {
    if (!event.isUserInput) {
      return;
    }

    const currentFilters = this.filters();
    const transactionTypes = event.selected
      ? [...currentFilters.transactionTypes, type]
      : currentFilters.transactionTypes.filter(
          (t: TransactionType) => t !== type,
        );

    this.filters.set({ transactionTypes });
  }
}
