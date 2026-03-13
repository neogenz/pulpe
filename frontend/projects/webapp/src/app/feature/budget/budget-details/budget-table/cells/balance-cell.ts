import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AppCurrencyPipe } from '@core/currency';
import { UserSettingsApi } from '@core/user-settings';

import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from '../../data-core';

@Component({
  selector: 'pulpe-balance-cell',
  imports: [AppCurrencyPipe, MatIconModule],
  template: `
    <div class="inline-flex items-center gap-1">
      <mat-icon
        class="text-sm! w-4! h-4!"
        [class.text-financial-income]="line().data.kind === 'income'"
        [class.text-financial-negative]="
          line().data.kind === 'expense' || line().data.kind === 'saving'
        "
      >
        @if (line().data.kind === 'income') {
          trending_up
        } @else {
          trending_down
        }
      </mat-icon>
      <span
        class="ph-no-capture text-body-medium font-medium"
        [class.text-financial-income]="line().metadata.cumulativeBalance >= 0"
        [class.text-financial-negative]="line().metadata.cumulativeBalance < 0"
      >
        {{
          line().metadata.cumulativeBalance | appCurrency: currency() : '1.0-0'
        }}
      </span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceCell {
  readonly #userSettings = inject(UserSettingsApi);
  protected readonly currency = this.#userSettings.currency;
  readonly line = input.required<BudgetLineTableItem | TransactionTableItem>();
}
