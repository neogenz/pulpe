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
