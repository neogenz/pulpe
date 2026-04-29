import { Pipe, type PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { buildConversionLabel } from './conversion-label';

interface ConversionSource {
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
}

@Pipe({ name: 'conversionLabel' })
export class ConversionLabelPipe implements PipeTransform {
  readonly #transloco = inject(TranslocoService);

  transform(source: ConversionSource | null | undefined): string {
    if (!source) return '';
    return buildConversionLabel(
      this.#transloco,
      source.originalAmount,
      source.originalCurrency,
      source.exchangeRate,
    );
  }
}
