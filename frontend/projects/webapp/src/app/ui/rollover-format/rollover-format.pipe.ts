import { Pipe, type PipeTransform } from '@angular/core';
import { format } from 'date-fns';
import { frCH } from 'date-fns/locale';

@Pipe({
  name: 'rolloverFormat',
  standalone: true,
})
export class RolloverFormatPipe implements PipeTransform {
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

    if (monthIndex < 0 || monthIndex >= 12) {
      return name;
    }

    const date = new Date(parseInt(year, 10), monthIndex, 1);
    const monthName = format(date, 'MMMM', { locale: frCH });

    return `Report ${monthName} ${year}`;
  }
}
