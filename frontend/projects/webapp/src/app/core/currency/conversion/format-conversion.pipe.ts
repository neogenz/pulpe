import { Pipe, type PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { formatConversion } from './format-conversion';

interface ConversionSource {
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
}

@Pipe({ name: 'formatConversion' })
export class FormatConversionPipe implements PipeTransform {
  readonly #transloco = inject(TranslocoService);

  transform(source: ConversionSource | null | undefined): string {
    if (!source) return '';
    return formatConversion(
      this.#transloco,
      source.originalAmount,
      source.originalCurrency,
      source.exchangeRate,
    );
  }
}
