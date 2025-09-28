import { Pipe, type PipeTransform } from '@angular/core';
import type { TransactionRecurrence } from '@pulpe/shared';

@Pipe({
  name: 'recurrenceLabel',
})
export class RecurrenceLabelPipe implements PipeTransform {
  transform(recurrence: TransactionRecurrence): string {
    const labels: Record<TransactionRecurrence, string> = {
      fixed: 'Tous les mois',
      one_off: 'Une seule fois',
    };
    return labels[recurrence];
  }
}
