import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { TransactionKind } from 'pulpe-shared';
import { TransactionLabelPipe } from '@ui/transaction-display';

/**
 * Colored dot indicator for budget line kind (income/expense/saving).
 */
@Component({
  selector: 'pulpe-budget-kind-indicator',
  imports: [MatTooltipModule, TransactionLabelPipe],
  template: `
    <div
      class="rounded-full flex-shrink-0"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.background-color]="
        kind() === 'income'
          ? 'var(--pulpe-financial-income)'
          : kind() === 'expense'
            ? 'var(--pulpe-financial-expense)'
            : 'var(--pulpe-financial-savings)'
      "
      [matTooltip]="kind() | transactionLabel"
    ></div>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetKindIndicator {
  readonly kind = input.required<TransactionKind>();
  readonly size = input(12);
}
