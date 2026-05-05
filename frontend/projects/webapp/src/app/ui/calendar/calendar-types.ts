/**
 * Generic calendar interfaces for reusable calendar components.
 * These interfaces are domain-agnostic and can be used across features.
 */

export interface CalendarMonth {
  /** Unique identifier for the month tile */
  id: string;

  /** Month number (1-12) */
  month: number;

  /** Year (e.g., 2025) */
  year: number;

  /** Display name for the month (e.g., "Janvier 2025") */
  displayName: string;

  /** Whether this month has associated content/data */
  hasContent: boolean;

  /** Optional numeric value to display (e.g., budget amount) */
  value?: number;

  /** Visual status for styling purposes */
  status?: 'positive' | 'negative' | 'neutral' | 'warning';

  /** Optional period display string (e.g., "27 fév - 26 mars") */
  period?: string;
}

export interface CalendarYear {
  /** The year being displayed */
  year: number;

  /** Array of months for the year */
  months: CalendarMonth[];

  /** Optional current date for highlighting */
  currentDate?: {
    month: number;
    year: number;
  };
}

/**
 * i18n labels for `MonthTile` and `YearCalendar`.
 * UI layer cannot inject TranslocoService — labels are passed in by the consumer.
 */
export interface MonthTileLabels {
  /** Pill text shown on the current month (e.g., "Actuel"). */
  current: string;
  /** Header above the amount on a month with content (e.g., "Disponible"). */
  available: string;
  /** Label below the plus icon on an empty month (e.g., "Créer"). */
  create: string;
  /** Suffix appended to the aria-label of months with content (e.g., "disponible"). */
  availableSuffixAriaLabel: string;
  /** Aria-label for empty months (e.g., "créer un budget"). */
  createBudgetAriaLabel: string;
}

export function createEmptyCalendarMonth(
  month: number,
  year: number,
  displayName: string,
): CalendarMonth {
  return {
    id: `${month}-${year}`,
    month,
    year,
    displayName,
    hasContent: false,
  };
}
