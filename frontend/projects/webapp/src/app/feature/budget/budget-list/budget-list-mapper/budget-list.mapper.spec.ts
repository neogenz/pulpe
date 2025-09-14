import { describe, it, expect } from 'vitest';
import { mapToCalendarYear } from './budget-list.mapper';
import type { Budget } from '@pulpe/shared';
import type { BudgetPlaceholder } from '../budget-state';

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
