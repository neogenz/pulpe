import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import type { BudgetLineTableItem } from '../../data-core';

@Component({
  selector: 'pulpe-remaining-cell',
  imports: [CurrencyPipe, MatProgressBarModule],
  template: `
    @if (line().consumption?.hasTransactions) {
      @let remaining = line().data.amount - line().consumption!.consumed;

      <div class="flex flex-col items-end gap-1">
        <div class="flex flex-col items-center">
          <span
            class="ph-no-capture text-body-medium font-semibold"
            [class.text-financial-warning]="
              line().consumption!.consumptionState === 'near-limit'
            "
            [class.text-financial-over-budget]="
              line().consumption!.consumptionState === 'over-budget'
            "
          >
            {{ remaining | currency: 'CHF' : 'symbol' : '1.0-0' }}
            @if (line().consumption!.consumptionState === 'over-budget') {
              <span class="text-label-small font-normal ml-1">dépassé</span>
            }
          </span>
          @if (!line().metadata.isRollover) {
            <mat-progress-bar
              mode="determinate"
              [value]="
                line().consumption!.percentage > 100
                  ? 100
                  : line().consumption!.percentage
              "
              [class.near-limit-bar]="
                line().consumption!.consumptionState === 'near-limit'
              "
              [class.over-budget-bar]="
                line().consumption!.consumptionState === 'over-budget'
              "
              class="h-1.5! w-24! rounded-full"
            />
          }
        </div>
      </div>
    }
  `,
  styles: `
    mat-progress-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-secondary);
    }
    .near-limit-bar {
      --mat-progress-bar-active-indicator-color: var(
        --pulpe-financial-near-limit
      );
    }
    .over-budget-bar {
      --mat-progress-bar-active-indicator-color: var(
        --pulpe-financial-over-budget
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemainingCell {
  readonly line = input.required<BudgetLineTableItem>();
}
