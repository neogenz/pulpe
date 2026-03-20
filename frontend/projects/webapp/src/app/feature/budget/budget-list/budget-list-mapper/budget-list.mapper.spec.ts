import { describe, it, expect } from 'vitest';
import {
  buildCalendarYears,
  mapToCalendarYear,
  resolveSelectedYearIndex,
} from './budget-list.mapper';
import type { Budget } from 'pulpe-shared';
import type { CalendarYear } from '@ui/calendar/calendar-types';
import type { BudgetPlaceholder } from '../budget-list-store';

function createBudget(month: number, year: number): Budget {
  return {
    id: `budget-${year}-${month}`,
    userId: 'user1',
    month,
    year,
    description: `Budget ${month}/${year}`,
    endingBalance: 1000,
    templateId: 'template-1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };
}

function fullYearPlaceholders(year: number): BudgetPlaceholder[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, year }));
}

describe('mapToCalendarYear', () => {
  it('should map empty budgets array to calendar year', () => {
    const result = mapToCalendarYear(2025, []);

    expect(result).toEqual({
      year: 2025,
      months: [],
    });
  });

  it('should map budget with all properties to calendar month', () => {
    const budget: Budget = {
      id: 'budget-1',
      month: 1,
      year: 2025,
      description: 'January budget',
      templateId: 'template-1',
      endingBalance: 1500.5,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };

    const result = mapToCalendarYear(2025, [budget]);

    expect(result.year).toBe(2025);
    expect(result.months).toHaveLength(1);
    expect(result.months[0]).toEqual({
      id: 'budget-1',
      month: 1,
      year: 2025,
      hasContent: true,
      value: 1500.5,
      displayName: 'janvier 2025',
      period: undefined,
      status: 'positive',
    });
  });

  it('should map budget with null endingBalance to undefined value', () => {
    const budget: Budget = {
      id: 'budget-2',
      month: 3,
      year: 2025,
      description: 'March budget',
      templateId: 'template-1',
      endingBalance: null,
      createdAt: '2025-03-01',
      updatedAt: '2025-03-01',
    };

    const result = mapToCalendarYear(2025, [budget]);

    expect(result.months[0].value).toBeUndefined();
  });

  it('should map placeholder to empty calendar month', () => {
    const placeholder: BudgetPlaceholder = {
      month: 6,
      year: 2025,
    };

    const result = mapToCalendarYear(2025, [placeholder]);

    expect(result.months).toHaveLength(1);
    expect(result.months[0]).toEqual({
      id: expect.any(String),
      month: 6,
      year: 2025,
      hasContent: false,
      displayName: 'juin 2025',
    });
  });

  it('should map mixed budgets and placeholders', () => {
    const budget: Budget = {
      id: 'budget-3',
      month: 2,
      year: 2025,
      description: 'February budget',
      templateId: 'template-1',
      endingBalance: 2000,
      createdAt: '2025-02-01',
      updatedAt: '2025-02-01',
    };

    const placeholder: BudgetPlaceholder = {
      month: 4,
      year: 2025,
    };

    const result = mapToCalendarYear(2025, [budget, placeholder]);

    expect(result.months).toHaveLength(2);
    expect(result.months[0].hasContent).toBe(true);
    expect(result.months[0].value).toBe(2000);
    expect(result.months[1].hasContent).toBe(false);
    expect(result.months[1].value).toBeUndefined();
  });

  it('should format display names in French with correct month names', () => {
    const budgets: BudgetPlaceholder[] = [
      { month: 1, year: 2025 },
      { month: 7, year: 2025 },
      { month: 12, year: 2025 },
    ];

    const result = mapToCalendarYear(2025, budgets);

    expect(result.months[0].displayName).toBe('janvier 2025');
    expect(result.months[1].displayName).toBe('juillet 2025');
    expect(result.months[2].displayName).toBe('décembre 2025');
  });

  it('should handle year 2024 correctly', () => {
    const budget: Budget = {
      id: 'budget-2024',
      month: 2,
      year: 2024,
      description: 'February 2024 budget',
      templateId: 'template-1',
      endingBalance: 1000,
      createdAt: '2024-02-01',
      updatedAt: '2024-02-01',
    };

    const result = mapToCalendarYear(2024, [budget]);

    expect(result.year).toBe(2024);
    expect(result.months[0].year).toBe(2024);
    expect(result.months[0].displayName).toBe('février 2024');
  });
});

describe('buildCalendarYears', () => {
  const CURRENT_YEAR = 2026;

  it('should return 8 years with empty months when no budgets exist', () => {
    const result = buildCalendarYears(new Map(), null, CURRENT_YEAR);

    expect(result).toHaveLength(8);
    expect(result[0].year).toBe(CURRENT_YEAR);
    expect(result[7].year).toBe(CURRENT_YEAR + 7);
    result.forEach((calendarYear) => {
      expect(calendarYear.months).toHaveLength(12);
      calendarYear.months.forEach((month) => {
        expect(month.hasContent).toBe(false);
      });
    });
  });

  it('should include past years with existing budgets', () => {
    const pastYear = CURRENT_YEAR - 2;
    const budgets = new Map<number, (Budget | BudgetPlaceholder)[]>([
      [pastYear, fullYearPlaceholders(pastYear)],
    ]);

    const result = buildCalendarYears(budgets, null, CURRENT_YEAR);

    expect(result[0].year).toBe(pastYear);
    expect(result).toHaveLength(9);
  });

  it('should merge existing years with future years without duplicates', () => {
    const budgets = new Map<number, (Budget | BudgetPlaceholder)[]>([
      [CURRENT_YEAR, [createBudget(3, CURRENT_YEAR)]],
      [CURRENT_YEAR + 1, [createBudget(6, CURRENT_YEAR + 1)]],
    ]);

    const result = buildCalendarYears(budgets, null, CURRENT_YEAR);

    const years = result.map((cy) => cy.year);
    const uniqueYears = [...new Set(years)];
    expect(years).toEqual(uniqueYears);
    expect(result).toHaveLength(8);
  });

  it('should sort years ascending', () => {
    const budgets = new Map<number, (Budget | BudgetPlaceholder)[]>([
      [CURRENT_YEAR + 10, fullYearPlaceholders(CURRENT_YEAR + 10)],
      [CURRENT_YEAR - 1, fullYearPlaceholders(CURRENT_YEAR - 1)],
    ]);

    const result = buildCalendarYears(budgets, null, CURRENT_YEAR);

    const years = result.map((cy) => cy.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('should use existing budgets data for years that have them', () => {
    const budget = createBudget(3, CURRENT_YEAR);
    const budgets = new Map<number, (Budget | BudgetPlaceholder)[]>([
      [CURRENT_YEAR, [budget]],
    ]);

    const result = buildCalendarYears(budgets, null, CURRENT_YEAR);

    const currentYearResult = result.find((cy) => cy.year === CURRENT_YEAR)!;
    expect(currentYearResult.months).toHaveLength(1);
    expect(currentYearResult.months[0].hasContent).toBe(true);
    expect(currentYearResult.months[0].id).toBe(budget.id);
  });

  it('should create 12 empty months for years without existing budgets', () => {
    const result = buildCalendarYears(new Map(), null, CURRENT_YEAR);

    const futureYear = result.find((cy) => cy.year === CURRENT_YEAR + 3)!;
    expect(futureYear.months).toHaveLength(12);
    futureYear.months.forEach((month, index) => {
      expect(month.hasContent).toBe(false);
      expect(month.month).toBe(index + 1);
    });
  });

  it('should pass payDayOfMonth through to calendar year mapping', () => {
    const budget = createBudget(3, CURRENT_YEAR);
    const budgets = new Map<number, (Budget | BudgetPlaceholder)[]>([
      [CURRENT_YEAR, [budget]],
    ]);

    const result = buildCalendarYears(budgets, 25, CURRENT_YEAR);

    const currentYearResult = result.find((cy) => cy.year === CURRENT_YEAR)!;
    expect(currentYearResult.months[0].period).toBeDefined();
  });
});

describe('resolveSelectedYearIndex', () => {
  const years = [
    { year: 2024 },
    { year: 2025 },
    { year: 2026 },
  ] as CalendarYear[];

  it('should return 0 when selectedYear is null', () => {
    expect(resolveSelectedYearIndex(null, years)).toBe(0);
  });

  it('should return 0 when calendarYears is empty', () => {
    expect(resolveSelectedYearIndex(2025, [])).toBe(0);
  });

  it('should return the index of the selected year', () => {
    expect(resolveSelectedYearIndex(2024, years)).toBe(0);
    expect(resolveSelectedYearIndex(2025, years)).toBe(1);
    expect(resolveSelectedYearIndex(2026, years)).toBe(2);
  });

  it('should return 0 when selected year is not found', () => {
    expect(resolveSelectedYearIndex(2030, years)).toBe(0);
  });
});
