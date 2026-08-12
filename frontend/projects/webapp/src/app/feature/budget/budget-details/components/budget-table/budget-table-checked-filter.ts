import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import {
  type MatButtonToggleChange,
  MatButtonToggleModule,
} from '@angular/material/button-toggle';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-budget-table-checked-filter',
  imports: [MatButtonToggleModule, TranslocoPipe],
  template: `
    <span class="sr-only" role="status" aria-live="polite">
      {{
        isShowingOnlyUnchecked()
          ? ('budget.uncheckedItemsDisplay' | transloco)
          : ('budget.allItemsDisplay' | transloco)
      }}
    </span>
    <mat-button-toggle-group
      class="checked-filter-chips"
      [attr.aria-label]="'budget.filterLabel' | transloco"
      [value]="isShowingOnlyUnchecked()"
      (change)="onFilterChange($event)"
    >
      <mat-button-toggle [value]="true" data-testid="unchecked-filter-chip">
        {{ 'budget.filterUnchecked' | transloco }}
      </mat-button-toggle>
      <mat-button-toggle [value]="false" data-testid="all-items-filter-chip">
        {{ 'budget.filterAll' | transloco }}
      </mat-button-toggle>
    </mat-button-toggle-group>
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

  onFilterChange(event: MatButtonToggleChange): void {
    this.isShowingOnlyUncheckedChange.emit(event.value === true);
  }
}
