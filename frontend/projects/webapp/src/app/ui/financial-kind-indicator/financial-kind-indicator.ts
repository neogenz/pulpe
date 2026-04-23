import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { TransactionKind } from 'pulpe-shared';
import { TransactionLabelPipe } from '@ui/transaction-display';

const KIND_COLORS: Record<TransactionKind, string> = {
  income: 'var(--pulpe-financial-income)',
  expense: 'var(--pulpe-financial-expense)',
  saving: 'var(--pulpe-financial-savings)',
} as const;

@Component({
  selector: 'pulpe-financial-kind-indicator',
  imports: [MatTooltipModule, TransactionLabelPipe],
  template: `
    <div
      class="rounded-full flex-shrink-0"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.background-color]="backgroundColor()"
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
export class FinancialKindIndicator {
  readonly kind = input.required<TransactionKind>();
  readonly size = input(12);

  protected readonly backgroundColor = computed(() => KIND_COLORS[this.kind()]);
}
