import { Pipe, type PipeTransform, inject } from '@angular/core';
import { format } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { Logger } from '@core/logging/logger';

@Pipe({
  name: 'rolloverFormat',
  standalone: true,
})
export class RolloverFormatPipe implements PipeTransform {
  readonly #logger = inject(Logger);
  readonly #ROLLOVER_PATTERN = /rollover_(\d+)_(\d+)/;

  transform(name: string): string {
    if (!name?.startsWith('rollover_')) {
      return name;
    }

    const match = name.match(this.#ROLLOVER_PATTERN);
    if (!match) {
      return name;
    }

    const [, month, year] = match;
    const monthIndex = parseInt(month, 10) - 1;

    // Add bounds checking for month index safety
    if (monthIndex < 0 || monthIndex >= 12) {
      this.#logger.warn(
        `Invalid month index ${monthIndex} in rollover name: ${name}`,
        { monthIndex, name, operation: 'rollover_format_transform' },
      );
      return name; // Return original if month is invalid
    }

    const date = new Date(parseInt(year, 10), monthIndex, 1);
    const monthName = format(date, 'MMMM', { locale: frCH });

    return `Report ${monthName} ${year}`;
  }
}
