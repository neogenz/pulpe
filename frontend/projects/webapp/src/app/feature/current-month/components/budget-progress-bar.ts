import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'pulpe-budget-progress-bar',
  imports: [MatCardModule, MatIconModule, CurrencyPipe, MatProgressBarModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header class="mb-4">
        <div class="flex flex-col">
          <div
            class="text-display-small font-medium"
            [class.text-primary]="!isOverBudget()"
            [class.text-error]="isOverBudget()"
          >
            {{ balance() | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH' }}
          </div>
          <div class="text-title-medium text-on-surface">
            @if (!isOverBudget()) {
              restant sur
            } @else {
              dépassé sur
            }
            {{ totalIncome() | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH' }}
          </div>
        </div>
      </mat-card-header>
      <mat-card-content>
        <div class="space-y-4">
          @if (isOverBudget()) {
            <div
              class="inline-flex items-center gap-2 px-3 py-1 bg-error-container text-on-error-container rounded-lg"
            >
              <mat-icon class="icon-filled">report</mat-icon>
              <span class="text-label-large">Tu es en hors budget !</span>
            </div>
          }
          <div class="space-y-2">
            <mat-progress-bar
              mode="determinate"
              [value]="budgetUsedPercentage()"
              [color]="isOverBudget() ? 'warn' : 'primary'"
            />
            <div class="text-label-small text-on-surface-variant">
              {{ displayPercentage() }}% du budget dépensé
            </div>
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetProgressBar {
  // Essential inputs from parent
  balance = input.required<number>();
  usedAmount = input.required<number>();
  totalIncome = input.required<number>();

  // Computed display values
  remainingAmount = computed(() => {
    const total = this.balance();
    const used = this.usedAmount();
    return total - used; // Allow negative values to show overspending
  });

  isOverBudget = computed(() => {
    return this.balance() < 0;
  });

  budgetUsedPercentage = computed(() => {
    const total = this.totalIncome();
    const used = this.usedAmount();

    // Handle edge cases
    if (!total || total <= 0) return 0;
    if (!used || used < 0) return 0;

    const percentage = (used / total) * 100;
    // Cap at 100% for progress bar visual, but allow actual percentage to be displayed
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  displayPercentage = computed(() => {
    const total = this.totalIncome();
    const used = this.usedAmount();

    // Handle edge cases
    if (!total || total <= 0) return 0;
    if (!used || used < 0) return 0;

    const percentage = (used / total) * 100;
    // Return actual percentage, even if > 100%
    return Math.round(percentage);
  });
}
