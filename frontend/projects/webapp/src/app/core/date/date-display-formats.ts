import type { SupportedCurrency } from 'pulpe-shared';
import { MAT_DATE_FNS_FORMATS } from '@angular/material-date-fns-adapter';

/**
 * Date display formats whose separator follows the user's currency locale:
 * CHF (fr-CH) uses dots, EUR (fr-FR) uses slashes.
 */
export interface DateDisplayFormats {
  /** Full date — e.g. `31.12.2026` (CHF) / `31/12/2026` (EUR). */
  shortDate: string;
  /** Day + month — e.g. `31.12` (CHF) / `31/12` (EUR). */
  dayMonth: string;
  /** Month + year — e.g. `12.2026` (CHF) / `12/2026` (EUR). */
  monthYear: string;
  /** Separator shared by all three formats — `.` (CHF) / `/` (EUR). */
  separator: string;
}

const DATE_DISPLAY_FORMATS_BY_CURRENCY: Record<
  SupportedCurrency,
  DateDisplayFormats
> = {
  CHF: {
    shortDate: 'dd.MM.yyyy',
    dayMonth: 'dd.MM',
    monthYear: 'MM.yyyy',
    separator: '.',
  },
  EUR: {
    shortDate: 'dd/MM/yyyy',
    dayMonth: 'dd/MM',
    monthYear: 'MM/yyyy',
    separator: '/',
  },
};

export function getDateDisplayFormats(
  currency: SupportedCurrency,
): DateDisplayFormats {
  return DATE_DISPLAY_FORMATS_BY_CURRENCY[currency];
}

export function getMonthYearDateFormats(currency: SupportedCurrency) {
  const monthYear = getDateDisplayFormats(currency).monthYear;
  return {
    ...MAT_DATE_FNS_FORMATS,
    parse: {
      ...MAT_DATE_FNS_FORMATS.parse,
      dateInput: ['MM.yyyy', 'MM/yyyy'],
    },
    display: {
      ...MAT_DATE_FNS_FORMATS.display,
      dateInput: monthYear,
      monthYearLabel: 'MMM yyyy',
      dateA11yLabel: monthYear,
      monthYearA11yLabel: 'MMMM yyyy',
    },
  };
}
