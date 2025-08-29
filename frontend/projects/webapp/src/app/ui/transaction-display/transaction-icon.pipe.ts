import { Pipe, type PipeTransform } from '@angular/core';
import type { TransactionKind } from '@pulpe/shared';

@Pipe({
  name: 'transactionIcon',
  standalone: true,
})
export class TransactionIconPipe implements PipeTransform {
  transform(kind: TransactionKind): string {
    const icons: Record<TransactionKind, string> = {
      income: 'trending_up',
      expense: 'trending_down',
      saving: 'savings',
    };
    return icons[kind];
  }
}
