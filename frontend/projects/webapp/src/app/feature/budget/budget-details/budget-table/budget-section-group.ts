import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';

/**
 * Collapsible section group for budget categories
 *
 * Visual structure:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  📥 Revenus (3)                                    [▼]       │
 * ├──────────────────────────────────────────────────────────────┤
 * │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
 * │ │   Card 1    │ │   Card 2    │ │   Card 3    │              │
 * │ └─────────────┘ └─────────────┘ └─────────────┘              │
 * └──────────────────────────────────────────────────────────────┘
 */
@Component({
  selector: 'pulpe-budget-section-group',
  imports: [MatExpansionModule, MatIconModule],
  template: `
    <mat-expansion-panel
      [expanded]="true"
      class="!bg-transparent !shadow-none !rounded-2xl"
    >
      <mat-expansion-panel-header
        class="!bg-surface-container-low !rounded-2xl hover:!bg-surface-container"
      >
        <mat-panel-title>
          <div class="flex items-center gap-2">
            <mat-icon class="text-lg text-on-surface-variant">{{
              icon()
            }}</mat-icon>
            <span class="text-title-medium font-semibold">{{ title() }}</span>
            <span class="text-label-medium text-on-surface-variant">
              ({{ itemCount() }})
            </span>
          </div>
        </mat-panel-title>
      </mat-expansion-panel-header>

      <!-- Grid container for cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
        <ng-content />
      </div>
    </mat-expansion-panel>
  `,
  styles: `
    :host {
      display: block;
    }

    /* Override expansion panel styles for better integration */
    ::ng-deep .mat-expansion-panel-body {
      padding: 0 !important;
    }

    ::ng-deep .mat-expansion-panel-header {
      padding: 0 16px !important;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetSectionGroup {
  readonly title = input.required<string>();
  readonly icon = input.required<string>();
  readonly itemCount = input.required<number>();
}
