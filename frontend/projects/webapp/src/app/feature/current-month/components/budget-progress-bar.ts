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
          <div class="text-display-small font-medium text-primary">
            {{
              remainingAmount() | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH'
            }}
          </div>
          <div class="text-title-medium text-on-surface">
            restant sur
            {{ totalBudget() | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH' }}
          </div>
        </div>
      </mat-card-header>
      <mat-card-content>
        <div class="space-y-2">
          <mat-progress-bar
            mode="determinate"
            [value]="budgetUsedPercentage()"
          />
          <div class="text-label-small text-on-surface-variant">
            {{ budgetUsedPercentage() }}% du budget dépensé
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
          track-shape: 20px,
        )
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetProgressBar {
  totalBudget = input.required<number>();
  remainingAmount = input.required<number>();
  budgetUsedPercentage = computed(() => {
    return (this.remainingAmount() / this.totalBudget()) * 100;
  });
}
