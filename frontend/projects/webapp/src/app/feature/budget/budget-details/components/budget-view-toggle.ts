import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import type { BudgetViewMode } from '../view-models/budget-view-mode';

@Component({
  selector: 'pulpe-budget-view-toggle',
  imports: [MatButtonToggleModule, MatIconModule, TranslocoPipe],
  template: `
    <mat-button-toggle-group
      aria-label="Mode d'affichage"
      [value]="viewMode()"
      (change)="viewMode.set($event.value)"
    >
      <mat-button-toggle value="envelopes" data-testid="grid-mode-chip">
        <mat-icon>grid_view</mat-icon>
        {{ 'budget.viewGrid' | transloco }}
      </mat-button-toggle>
      <mat-button-toggle value="table" data-testid="table-mode-chip">
        <mat-icon>table_rows</mat-icon>
        {{ 'budget.viewTable' | transloco }}
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
export class BudgetViewToggle {
  viewMode = model<BudgetViewMode>('envelopes');
}
