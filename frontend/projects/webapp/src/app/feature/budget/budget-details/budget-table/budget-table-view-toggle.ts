import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import {
  type MatChipSelectionChange,
  MatChipsModule,
} from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import type { BudgetTableViewMode } from './budget-table-view-mode';

@Component({
  selector: 'pulpe-budget-table-view-toggle',
  imports: [MatChipsModule, MatIconModule],
  template: `
    <mat-chip-listbox
      class="view-toggle-chips"
      aria-label="Mode d'affichage"
      [hideSingleSelectionIndicator]="true"
    >
      <mat-chip-option
        [selected]="viewMode() === 'envelopes'"
        (selectionChange)="onViewModeChange('envelopes', $event)"
        data-testid="envelope-mode-chip"
      >
        <mat-icon matChipAvatar>folder</mat-icon>
        Enveloppes
      </mat-chip-option>
      <mat-chip-option
        [selected]="viewMode() === 'transactions'"
        (selectionChange)="onViewModeChange('transactions', $event)"
        data-testid="transactions-mode-chip"
      >
        <mat-icon matChipAvatar>receipt</mat-icon>
        Transactions
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
export class BudgetTableViewToggle {
  viewMode = model<BudgetTableViewMode>('envelopes');

  onViewModeChange(
    mode: BudgetTableViewMode,
    event: MatChipSelectionChange,
  ): void {
    if (!event.isUserInput || !event.selected) {
      return;
    }
    this.viewMode.set(mode);
  }
}
