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
    <mat-card
      appearance="outlined"
      class="rounded-3xl expressive-progress-card"
    >
      <mat-card-header class="mb-4">
        <div class="flex flex-col gap-3 w-full">
          <!-- Main line: Expenses over Available -->
          <div class="flex justify-between items-baseline gap-2">
            <div class="flex flex-col" [class.text-error]="isOverBudget()">
              <span class="text-body-small md:text-body flex items-center gap-1"
                >Dépenses CHF
                @if (isOverBudget()) {
                  <mat-icon
                    class="ph-no-capture warning-icon"
                    matTooltipClass="ph-no-capture"
                    [matTooltip]="
                      'Tu es en dépassement de ' +
                      (overBudgetAmount() | number: '1.2-2' : 'de-CH') +
                      ' CHF'
                    "
                    class="icon-filled"
                    >report</mat-icon
                  >
                }
              </span>
              <span
                class="text-headline-small md:text-headline-large expenses-value"
              >
                <div
                  class="flex flex-col ph-no-capture"
                  data-testid="expenses-amount"
                >
                  {{ expenses() | number: '1.2-2' : 'de-CH' }}
                </div>
              </span>
            </div>
            <div class="flex flex-col text-right">
              <span class="text-body-small md:text-body text-on-surface-variant"
                >Disponible CHF</span
              >
              <span
                class="text-headline-small md:text-headline-large ph-no-capture available-value"
                [class.text-primary]="!isOverBudget() && remaining() > 0"
                [class.text-error]="isOverBudget()"
                data-testid="remaining-amount"
              >
                {{ remaining() | number: '1.2-2' : 'de-CH' }}
              </span>
            </div>
          </div>
        </div>
      </mat-card-header>
      <mat-card-content class="space-y-3">
        <div class="space-y-2">
          <div class="progress-container">
            <mat-progress-bar
              mode="determinate"
              [value]="budgetUsedPercentage()"
              [class.over-budget]="isOverBudget()"
              [class.near-limit]="
                budgetUsedPercentage() >= 80 && !isOverBudget()
              "
            />
          </div>
          <div
            class="text-label-small text-on-surface-variant ph-no-capture flex items-center gap-1"
            [class.text-error!]="isOverBudget()"
          >
            @if (displayPercentage() === -1) {
              <mat-icon class="text-base!">warning</mat-icon>
              Budget totalement dépassé
            } @else {
              <span
                class="percentage-badge"
                [class.warning]="budgetUsedPercentage() >= 80"
              >
                {{ displayPercentage() }}%
              </span>
              du budget dépensé (Limite CHF :
              {{ available() | number: '1.2-2' : 'de-CH' }})
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
          track-height: 12px,
          active-indicator-height: 12px,
        )
      );
    }

    /* MD3 Expressive Card */
    .expressive-progress-card {
      transition:
        transform var(--expressive-spatial-default-duration, 500ms)
          var(
            --expressive-spatial-default-easing,
            cubic-bezier(0.38, 1.21, 0.22, 1)
          ),
        box-shadow var(--expressive-effect-default-duration, 200ms)
          var(
            --expressive-effect-default-easing,
            cubic-bezier(0.34, 0.8, 0.34, 1)
          );

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--elevation-level2, 0 1px 3px 0 rgba(0, 0, 0, 0.1));
      }
    }

    /* Progress bar container with rounded corners */
    .progress-container {
      border-radius: 6px;
      overflow: hidden;
    }

    /* Warning icon animation */
    .warning-icon {
      animation: shake 0.5s ease-in-out;
    }

    @keyframes shake {
      0%,
      100% {
        transform: translateX(0);
      }
      25% {
        transform: translateX(-2px);
      }
      75% {
        transform: translateX(2px);
      }
    }

    /* Percentage badge */
    .percentage-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      border-radius: 12px;
      background-color: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-weight: 500;
      transition: background-color
        var(--expressive-effect-default-duration, 200ms)
        var(
          --expressive-effect-default-easing,
          cubic-bezier(0.34, 0.8, 0.34, 1)
        );

      &.warning {
        background-color: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }
    }

    /* Near limit pulse animation */
    .near-limit {
      animation: pulse-warning 2s ease-in-out infinite;
    }

    @keyframes pulse-warning {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    .over-budget {
      @include mat.progress-bar-overrides(
        (
          active-indicator-color: var(--mat-sys-error),
        )
      );
    }

    /* Available value styling */
    .available-value {
      font-weight: 600;
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
   * Absolute value of remaining for over budget situation
   */
  overBudgetAmount = computed(() => {
    return Math.abs(this.remaining());
  });
}
