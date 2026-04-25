import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import {
  type MatChipSelectionChange,
  MatChipsModule,
} from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import type { BudgetViewMode } from '../view-models/budget-view-mode';

@Component({
  selector: 'pulpe-budget-view-toggle',
  imports: [MatChipsModule, MatIconModule, TranslocoPipe],
  template: `
    <mat-chip-listbox
      class="view-toggle-chips"
      aria-label="Mode d'affichage"
      [hideSingleSelectionIndicator]="true"
    >
      <mat-chip-option
        [selected]="viewMode() === 'envelopes'"
        (selectionChange)="onViewModeChange('envelopes', $event)"
        data-testid="grid-mode-chip"
      >
        <mat-icon matChipAvatar>grid_view</mat-icon>
        {{ 'budget.viewGrid' | transloco }}
      </mat-chip-option>
      <mat-chip-option
        [selected]="viewMode() === 'table'"
        (selectionChange)="onViewModeChange('table', $event)"
        data-testid="table-mode-chip"
      >
        <mat-icon matChipAvatar>table_rows</mat-icon>
        {{ 'budget.viewTable' | transloco }}
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
export class BudgetViewToggle {
  viewMode = model<BudgetViewMode>('envelopes');

  onViewModeChange(mode: BudgetViewMode, event: MatChipSelectionChange): void {
    if (!event.isUserInput || !event.selected) {
      return;
    }
    this.viewMode.set(mode);
  }
}
