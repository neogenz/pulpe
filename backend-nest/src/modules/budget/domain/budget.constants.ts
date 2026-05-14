export type MonthRange = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type RolloverId<T extends string> = `rollover-${T}`;
export type RolloverName<
  M extends MonthRange,
  Y extends number,
> = `rollover_${M}_${Y}`;

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
    formatId: <T extends string>(budgetId: T): RolloverId<T> =>
      `rollover-${budgetId}`,
    formatName: <M extends MonthRange, Y extends number>(
      month: M,
      year: Y,
    ): RolloverName<M, Y> => `rollover_${month}_${year}`,
  },
} as const;
