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
      @let isExceeded = remaining < 0;

      <div class="flex flex-col items-end gap-1">
        <div class="flex flex-col items-center">
          <span
            class="text-body-medium font-semibold"
            [class.text-error]="isExceeded"
          >
            {{ remaining | currency: 'CHF' : 'symbol' : '1.0-0' }}
            @if (isExceeded) {
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
              [class.warn-bar]="line().consumption!.percentage > 100"
              class="h-1.5! w-24! rounded-full"
            />
          }
        </div>
      </div>
    }
  `,
  styles: `
    .warn-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemainingCell {
  readonly line = input.required<BudgetLineTableItem>();
}
