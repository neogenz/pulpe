import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import {
  type MatChipSelectionChange,
  MatChipsModule,
} from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-budget-table-checked-filter',
  imports: [MatChipsModule, MatIconModule],
  template: `
    <span class="sr-only" role="status" aria-live="polite">
      {{
        isShowingOnlyUnchecked()
          ? 'Affichage des éléments non comptabilisés'
          : 'Affichage de tous les éléments'
      }}
    </span>
    <mat-chip-listbox
      class="checked-filter-chips"
      aria-label="Filtrer les éléments"
      [hideSingleSelectionIndicator]="true"
    >
      <mat-chip-option
        [selected]="isShowingOnlyUnchecked()"
        (selectionChange)="onFilterChange(true, $event)"
        data-testid="unchecked-filter-chip"
      >
        <mat-icon matChipAvatar>check_box_outline_blank</mat-icon>
        Non comptabilisées
      </mat-chip-option>
      <mat-chip-option
        [selected]="!isShowingOnlyUnchecked()"
        (selectionChange)="onFilterChange(false, $event)"
        data-testid="all-items-filter-chip"
      >
        <mat-icon matChipAvatar>list</mat-icon>
        Toutes
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
export class BudgetTableCheckedFilter {
  readonly isShowingOnlyUnchecked = input(true);
  readonly isShowingOnlyUncheckedChange = output<boolean>();

  onFilterChange(
    showOnlyUnchecked: boolean,
    event: MatChipSelectionChange,
  ): void {
    if (!event.isUserInput || !event.selected) {
      return;
    }
    this.isShowingOnlyUncheckedChange.emit(showOnlyUnchecked);
  }
}
