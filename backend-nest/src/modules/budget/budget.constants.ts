// Template literal types for rollover formatting with precise constraints
export type MonthRange = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
/**
 * Template literal type for rollover IDs
 * @example RolloverId<"budget-123"> => "rollover-budget-123"
 */
export type RolloverId<T extends string> = `rollover-${T}`;

/**
 * Template literal type for rollover names with month validation
 * @example RolloverName<3, 2025> => "rollover_3_2025"
 */
export type RolloverName<
  M extends MonthRange,
  Y extends number,
> = `rollover_${M}_${Y}`;

// Type guards for runtime validation
export const isValidMonth = (month: number): month is MonthRange =>
  Number.isInteger(month) && month >= 1 && month <= 12;

export const BUDGET_CONSTANTS = {
  CURRENT_YEAR: new Date().getFullYear(),
  MIN_YEAR: 2020,
  MAX_YEAR: new Date().getFullYear() + 10,
  MONTH_MIN: 1,
  MONTH_MAX: 12,
  DESCRIPTION_MAX_LENGTH: 500,
  ROLLOVER: {
    ID_PREFIX: 'rollover-' as const,
    NAME_PREFIX: 'rollover_' as const,
    formatId: <T extends string>(budgetId: T): RolloverId<T> =>
      `rollover-${budgetId}`,
    formatName: <M extends MonthRange, Y extends number>(
      month: M,
      year: Y,
    ): RolloverName<M, Y> => `rollover_${month}_${year}`,
  },
} as const;
