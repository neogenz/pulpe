import { Pipe, type PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { buildConversionTooltip } from './conversion-tooltip';

interface ConversionSource {
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
}

@Pipe({ name: 'conversionTooltip' })
export class ConversionTooltipPipe implements PipeTransform {
  readonly #transloco = inject(TranslocoService);

  transform(source: ConversionSource | null | undefined): string {
    if (!source) return '';
    return buildConversionTooltip(
      this.#transloco,
      source.originalAmount,
      source.originalCurrency,
      source.exchangeRate,
    );
  }
}
