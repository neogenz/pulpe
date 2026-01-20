import { Directive, input } from '@angular/core';
import type { TransactionKind } from 'pulpe-shared';

@Directive({
  selector: '[pulpeFinancialKind]',
  host: {
    '[class.text-financial-income]': "kind() === 'income'",
    '[class.text-financial-expense]': "kind() === 'expense'",
    '[class.text-financial-savings]': "kind() === 'saving'",
  },
})
export class FinancialKindDirective {
  readonly kind = input.required<TransactionKind>({
    alias: 'pulpeFinancialKind',
  });
}
