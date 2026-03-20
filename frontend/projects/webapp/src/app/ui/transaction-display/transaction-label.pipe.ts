import { inject, Pipe, type PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { TransactionKind } from 'pulpe-shared';

@Pipe({
  name: 'transactionLabel',
})
export class TransactionLabelPipe implements PipeTransform {
  readonly #transloco = inject(TranslocoService);

  transform(kind: TransactionKind): string {
    return this.#transloco.translate(`transactionKind.${kind}`);
  }
}
