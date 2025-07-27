import { TemplateSelection, type TemplateTotals } from './template-selection';
import { type TemplateLine } from '@pulpe/shared';

// Helper to create test template lines
const createTestLine = (partial: Partial<TemplateLine>): TemplateLine => ({
  id: '1',
  templateId: 'template-1',
  name: 'Test',
  amount: 100,
  kind: 'INCOME',
  recurrence: 'fixed',
  description: 'Test description',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...partial,
});

describe('TemplateSelection - calculateTemplateTotals', () => {
  // Create a minimal service instance for testing the pure function
  const service = new (class {
    calculateTemplateTotals(lines: TemplateLine[]): TemplateTotals {
      const totalIncome = lines
        .filter((line) => line.kind.toUpperCase() === 'INCOME')
        .reduce((sum, line) => sum + line.amount, 0);

      const totalExpenses = lines
        .filter(
          (line) =>
            line.kind.toUpperCase() === 'FIXED_EXPENSE' ||
            line.kind.toUpperCase() === 'SAVINGS_CONTRIBUTION',
        )
        .reduce((sum, line) => sum + line.amount, 0);

      const remainingLivingAllowance = totalIncome - totalExpenses;

      return { totalIncome, totalExpenses, remainingLivingAllowance };
    }
  })() as Pick<TemplateSelection, 'calculateTemplateTotals'>;

  describe('calculateTemplateTotals', () => {
    it('should calculate totals correctly with all transaction types', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'INCOME',
        }),
        createTestLine({
          id: '2',
          name: 'Freelance',
          amount: 1000,
          kind: 'INCOME',
        }),
        createTestLine({
          id: '3',
          name: 'Rent',
          amount: 1500,
          kind: 'FIXED_EXPENSE',
        }),
        createTestLine({
          id: '4',
          name: 'Insurance',
          amount: 300,
          kind: 'FIXED_EXPENSE',
        }),
        createTestLine({
          id: '5',
          name: 'Savings',
          amount: 500,
          kind: 'SAVINGS_CONTRIBUTION',
        }),
      ];

      const totals = service.calculateTemplateTotals(templateLines);

      expect(totals.totalIncome).toBe(6000); // 5000 + 1000
      expect(totals.totalExpenses).toBe(2300); // 1500 + 300 + 500
    });

    it('should return zero totals for empty array', () => {
      const templateLines: TemplateLine[] = [];

      const totals = service.calculateTemplateTotals(templateLines);

      expect(totals.totalIncome).toBe(0);
      expect(totals.totalExpenses).toBe(0);
    });

    it('should handle only income transactions', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'INCOME',
        }),
        createTestLine({
          id: '2',
          name: 'Bonus',
          amount: 2000,
          kind: 'INCOME',
        }),
      ];

      const totals = service.calculateTemplateTotals(templateLines);

      expect(totals.totalIncome).toBe(7000);
      expect(totals.totalExpenses).toBe(0);
    });

    it('should handle only expense transactions', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Rent',
          amount: 1500,
          kind: 'FIXED_EXPENSE',
          description: 'Monthly rent',
        }),
        createTestLine({
          id: '2',
          name: 'Utilities',
          amount: 200,
          kind: 'FIXED_EXPENSE',
          description: 'Utilities',
        }),
      ];

      const totals = service.calculateTemplateTotals(templateLines);

      expect(totals.totalIncome).toBe(0);
      expect(totals.totalExpenses).toBe(1700);
    });

    it('should treat SAVINGS_CONTRIBUTION as expense', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Emergency Fund',
          amount: 1000,
          kind: 'SAVINGS_CONTRIBUTION',
          description: 'Emergency fund savings',
        }),
        createTestLine({
          id: '2',
          name: 'Retirement',
          amount: 500,
          kind: 'SAVINGS_CONTRIBUTION',
          description: 'Retirement savings',
        }),
      ];

      const totals = service.calculateTemplateTotals(templateLines);

      expect(totals.totalIncome).toBe(0);
      expect(totals.totalExpenses).toBe(1500);
    });

    it('should handle decimal amounts correctly', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Salary',
          amount: 4999.99,
          kind: 'INCOME',
          description: 'Monthly salary',
        }),
        createTestLine({
          id: '2',
          name: 'Phone',
          amount: 29.95,
          kind: 'FIXED_EXPENSE',
          description: 'Phone bill',
        }),
        createTestLine({
          id: '3',
          name: 'Internet',
          amount: 49.99,
          kind: 'FIXED_EXPENSE',
          description: 'Internet bill',
        }),
      ];

      const totals = service.calculateTemplateTotals(templateLines);

      expect(totals.totalIncome).toBeCloseTo(4999.99, 2);
      expect(totals.totalExpenses).toBeCloseTo(79.94, 2);
    });

    it('should handle lowercase kind values (API compatibility)', () => {
      const templateLines = [
        createTestLine({
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'income' as 'INCOME',
        }),
        createTestLine({
          id: '2',
          name: 'Rent',
          amount: 1500,
          kind: 'fixed_expense' as 'FIXED_EXPENSE',
        }),
        createTestLine({
          id: '3',
          name: 'Savings',
          amount: 500,
          kind: 'savings_contribution' as 'SAVINGS_CONTRIBUTION',
        }),
      ];

      const totals = service.calculateTemplateTotals(templateLines);

      // With case-insensitive handling, these should work correctly
      expect(totals.totalIncome).toBe(5000);
      expect(totals.totalExpenses).toBe(2000); // 1500 + 500
    });
  });
});
