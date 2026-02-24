import { Directive, input } from '@angular/core';
import type { TransactionKind } from 'pulpe-shared';

@Directive({ selector: '[pulpeFinancialKind]' })
export class StubFinancialKindDirective {
  readonly kind = input<TransactionKind | undefined>(undefined, {
    alias: 'pulpeFinancialKind',
  });
}
