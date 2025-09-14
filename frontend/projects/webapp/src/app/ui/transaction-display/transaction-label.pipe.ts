import { Pipe, type PipeTransform } from '@angular/core';
import type { TransactionKind } from '@pulpe/shared';

@Pipe({
  name: 'transactionLabel',
})
export class TransactionLabelPipe implements PipeTransform {
  transform(kind: TransactionKind): string {
    const labels: Record<TransactionKind, string> = {
      income: 'Revenu',
      expense: 'Dépense',
      saving: 'Épargne',
    };
    return labels[kind];
  }
}
