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

  /** Additional metadata that can be used by consuming features */
  metadata?: Record<string, unknown>;
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

export interface CalendarConfig {
  /** Whether to show empty months */
  showEmptyMonths?: boolean;

  /** Whether to allow interaction with empty months */
  allowEmptyMonthClick?: boolean;

  /** Custom CSS classes for the calendar container */
  containerClass?: string;

  /** Number of columns for different breakpoints */
  columns?: {
    mobile?: number; // default: 2
    tablet?: number; // default: 3
    desktop?: number; // default: 4
  };
}
