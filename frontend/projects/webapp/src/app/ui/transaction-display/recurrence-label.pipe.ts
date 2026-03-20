import { inject, Pipe, type PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { TransactionRecurrence } from 'pulpe-shared';

const RECURRENCE_KEY_MAP: Record<TransactionRecurrence, string> = {
  fixed: 'recurrence.fixed',
  one_off: 'recurrence.oneOff',
};

@Pipe({
  name: 'recurrenceLabel',
})
export class RecurrenceLabelPipe implements PipeTransform {
  readonly #transloco = inject(TranslocoService);

  transform(recurrence: TransactionRecurrence): string {
    return this.#transloco.translate(RECURRENCE_KEY_MAP[recurrence]);
  }
}
