import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Callout offering to auto-create the forecasts for repairable months (budgets
 * that exist but never got a linked savings line). Pure présentation: renders
 * nothing at `count() === 0`, singular/plural copy otherwise, emits a preview
 * request on demand — the page owns the amount calculation, the month
 * selection and the creation orchestration.
 */
@Component({
  selector: 'pulpe-goal-plan-repair-callout',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (count() > 0) {
      <div
        class="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4
               sm:flex-row sm:items-center sm:justify-between"
        data-testid="goal-plan-repair-callout"
      >
        <div class="flex items-start gap-3">
          <mat-icon
            class="mt-0.5 shrink-0 text-financial-savings"
            aria-hidden="true"
            >savings</mat-icon
          >
          <div class="flex flex-col gap-1">
            <h3 class="text-title-medium font-semibold">
              {{ 'savingsGoals.plan.repairTitle' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              {{
                (count() === 1
                  ? 'savingsGoals.plan.repairMessageOne'
                  : 'savingsGoals.plan.repairMessageMany'
                ) | transloco: { count: count() }
              }}
            </p>
          </div>
        </div>
        <button
          matButton="outlined"
          class="shrink-0 self-end sm:self-auto"
          (click)="previewRequested.emit()"
          [disabled]="isApplying()"
          data-testid="goal-plan-repair-preview"
        >
          <mat-icon>preview</mat-icon>
          {{ 'savingsGoals.plan.repairPreview' | transloco }}
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class GoalPlanRepairCallout {
  readonly count = input.required<number>();
  readonly isApplying = input(false);
  readonly previewRequested = output<void>();
}
