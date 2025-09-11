import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * BudgetProgressBar - Displays monthly budget progress
 *
 * Business concepts:
 * - Expenses: Total spent (expenses + savings) WITHOUT rollover
 * - Available: Total revenue + rollover (can be negative)
 * - Remaining: Available - Expenses
 *
 * Calculations:
 * - Used percentage = Expenses / Available * 100
 * - Budget exceeded if Remaining < 0
 */
@Component({
  selector: 'pulpe-budget-progress-bar',
  imports: [
    MatCardModule,
    MatIconModule,
    DecimalPipe,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header class="mb-4">
        <div class="flex flex-col gap-3 w-full">
          <!-- Main line: Expenses over Available -->
          <div class="flex justify-between items-baseline gap-2">
            <div class="flex flex-col" [class.text-error]="isOverBudget()">
              <span class="text-body-small md:text-body flex items-center gap-1"
                >Dépenses CHF
                @if (isOverBudget()) {
                  <mat-icon
                    [matTooltip]="overBudgetTooltip()"
                    class="icon-filled"
                    >report</mat-icon
                  >
                }
              </span>
              <span
                class="text-headline-small md:text-headline-large"
                [class.text-error]="isOverBudget()"
              >
                <div class="flex flex-col">
                  {{ expenses() | number: '1.2-2' : 'de-CH' }}
                  @if (isOverBudget()) {
                    <div
                      class="text-body-medium text-error"
                      [matTooltip]="overBudgetTooltip()"
                    >
                      {{ remaining() | number: '1.2-2' : 'de-CH' }} CHF
                    </div>
                  }
                </div>
              </span>
            </div>
            <div class="flex flex-col text-right text-outline">
              <span class="text-body-small md:text-body">Disponible CHF</span>
              <span class="text-headline-small md:text-headline-large">
                {{ available() | number: '1.2-2' : 'de-CH' }}
              </span>
            </div>
          </div>
        </div>
      </mat-card-header>
      <mat-card-content class="space-y-2">
        <div class="space-y-2">
          <mat-progress-bar
            mode="determinate"
            [value]="budgetUsedPercentage()"
            [class.over-budget]="isOverBudget()"
          />
          <div
            class="text-label-small text-on-surface-variant"
            [class.text-error!]="isOverBudget()"
          >
            @if (displayPercentage() === -1) {
              Budget totalement dépassé
            } @else {
              {{ displayPercentage() }}% du budget dépensé
            }
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    @use '@angular/material' as mat;

    :host {
      display: block;
      @include mat.progress-bar-overrides(
        (
          track-height: 10px,
          active-indicator-height: 10px,
        )
      );
    }

    .over-budget {
      @include mat.progress-bar-overrides(
        (
          active-indicator-color: var(--mat-sys-error),
        )
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetProgressBar {
  /**
   * Total expenses (expenses + savings) WITHOUT rollover
   */
  expenses = input.required<number>();

  /**
   * Total available amount (revenue + rollover)
   * Can be negative if rollover is significantly negative
   */
  available = input.required<number>();

  /**
   * Remaining amount (available - expenses)
   * Can be negative in case of budget overrun
   */
  remaining = computed(() => this.available() - this.expenses());

  /**
   * Detects if budget is exceeded
   * True if remaining amount < 0
   */
  isOverBudget = computed(() => {
    return this.remaining() < 0;
  });

  /**
   * Percentage used for visual progress bar
   * Capped at 100% for bar display
   * Formula: Expenses / Available * 100
   */
  budgetUsedPercentage = computed(() => {
    const available = this.available();
    const expenses = this.expenses();

    // Special cases: available <= 0
    if (available <= 0) {
      // If we have expenses with nothing available, we're at 100% minimum
      return expenses > 0 ? 100 : 0;
    }

    // Calculate spent percentage
    const percentage = (expenses / available) * 100;

    // Cap at 100% for visual bar
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  /**
   * Real percentage for text display
   * Can exceed 100% in case of budget overrun
   * Formula: Expenses / Available * 100
   * Returns -1 if available <= 0 and expenses > 0 (special case to handle in template)
   */
  displayPercentage = computed(() => {
    const available = this.available();
    const expenses = this.expenses();

    // Special cases: available <= 0
    if (available <= 0) {
      // If we have expenses with nothing available, return -1 to indicate special case
      // Otherwise 0 if no expenses
      return expenses > 0 ? -1 : 0;
    }

    // Calculate spent percentage
    const percentage = (expenses / available) * 100;

    // Return real percentage, even > 100%
    return Math.round(percentage);
  });

  /**
   * Tooltip text for over budget situation
   */
  overBudgetTooltip = computed(() => {
    const remainingAmount = Math.abs(this.remaining());
    return `Tu es en dépassement de ${remainingAmount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;
  });
}
