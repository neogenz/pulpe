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
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-budget-table-checked-filter',
  imports: [MatChipsModule, MatIconModule, TranslocoPipe],
  template: `
    <span class="sr-only" role="status" aria-live="polite">
      {{
        isShowingOnlyUnchecked()
          ? ('budget.uncheckedItemsDisplay' | transloco)
          : ('budget.allItemsDisplay' | transloco)
      }}
    </span>
    <mat-chip-listbox
      class="checked-filter-chips"
      [attr.aria-label]="'budget.filterLabel' | transloco"
      [hideSingleSelectionIndicator]="true"
    >
      <mat-chip-option
        [selected]="isShowingOnlyUnchecked()"
        (selectionChange)="onFilterChange(true, $event)"
        data-testid="unchecked-filter-chip"
      >
        <mat-icon matChipAvatar>check_box_outline_blank</mat-icon>
        {{ 'budget.filterUnchecked' | transloco }}
      </mat-chip-option>
      <mat-chip-option
        [selected]="!isShowingOnlyUnchecked()"
        (selectionChange)="onFilterChange(false, $event)"
        data-testid="all-items-filter-chip"
      >
        <mat-icon matChipAvatar>list</mat-icon>
        {{ 'budget.filterAll' | transloco }}
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
