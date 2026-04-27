import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AppCurrencyPipe } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';

import type { BudgetLineTableItem } from '../../view-models/table-items.view-model';

@Component({
  selector: 'pulpe-remaining-cell',
  imports: [AppCurrencyPipe, MatProgressBarModule, TranslocoPipe],
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
            {{ remaining | appCurrency: currency() : '1.2-2' }}
            @if (line().consumption!.consumptionState === 'over-budget') {
              <span class="text-label-small font-normal ml-1">{{
                'budgetLine.exceeded' | transloco
              }}</span>
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
  readonly #userSettings = inject(UserSettingsStore);
  protected readonly currency = this.#userSettings.currency;
  readonly line = input.required<BudgetLineTableItem>();
}
