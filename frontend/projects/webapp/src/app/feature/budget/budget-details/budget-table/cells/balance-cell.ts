import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from '../../data-core';

@Component({
  selector: 'pulpe-balance-cell',
  imports: [CurrencyPipe, MatIconModule],
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
        class="text-body-medium font-medium"
        [class.text-financial-income]="line().metadata.cumulativeBalance >= 0"
        [class.text-financial-negative]="line().metadata.cumulativeBalance < 0"
      >
        {{
          line().metadata.cumulativeBalance
            | currency: 'CHF' : 'symbol' : '1.0-0'
        }}
      </span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceCell {
  readonly line = input.required<BudgetLineTableItem | TransactionTableItem>();
}
