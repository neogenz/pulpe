import { Pipe, type PipeTransform } from '@angular/core';
import type { TransactionKind } from '@pulpe/shared';

@Pipe({
  name: 'transactionIcon',
})
export class TransactionIconPipe implements PipeTransform {
  transform(kind: TransactionKind): string {
    const icons: Record<TransactionKind, string> = {
      income: 'arrow_upward',
      expense: 'arrow_downward',
      saving: 'savings',
    };
    return icons[kind];
  }
}
