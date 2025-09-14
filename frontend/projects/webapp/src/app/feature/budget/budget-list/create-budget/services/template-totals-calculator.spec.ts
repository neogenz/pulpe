import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { type TemplateLine } from '@pulpe/shared';
import { TemplateTotalsCalculator } from './template-totals-calculator';

describe('TemplateTotalsCalculator', () => {
  let calculator: TemplateTotalsCalculator;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), TemplateTotalsCalculator],
    });
    calculator = TestBed.inject(TemplateTotalsCalculator);
  });

  it('should create', () => {
    expect(calculator).toBeTruthy();
  });

  describe('calculateTemplateTotals', () => {
    it('should calculate totals correctly with all types of lines', () => {
      const lines: TemplateLine[] = [
        {
          id: '1',
          templateId: 'template1',
          kind: 'income',
          name: 'Salary',
          description: 'Monthly salary',
          amount: 5000,
          recurrence: 'fixed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          templateId: 'template1',
          kind: 'expense',
          name: 'Rent',
          description: 'Monthly rent',
          amount: 1500,
          recurrence: 'fixed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          templateId: 'template1',
          kind: 'saving',
          name: 'Emergency Fund',
          description: 'Emergency fund',
          amount: 500,
          recurrence: 'fixed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const result = calculator.calculateTemplateTotals(lines);

      expect(result.totalIncome).toBe(5000);
      expect(result.totalExpenses).toBe(1500);
      expect(result.totalSavings).toBe(500);
      expect(result.remainingLivingAllowance).toBe(3000); // 5000 - (1500 + 500)
      expect(result.loading).toBe(false);
    });

    it('should handle empty lines array', () => {
      const result = calculator.calculateTemplateTotals([]);

      expect(result.totalIncome).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.totalSavings).toBe(0);
      expect(result.remainingLivingAllowance).toBe(0);
      expect(result.loading).toBe(false);
    });

    it('should handle negative living allowance', () => {
      const lines: TemplateLine[] = [
        {
          id: '1',
          templateId: 'template1',
          kind: 'income',
          name: 'Salary',
          description: 'Monthly salary',
          amount: 2000,
          recurrence: 'fixed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          templateId: 'template1',
          kind: 'expense',
          name: 'Rent',
          description: 'Monthly rent',
          amount: 2500,
          recurrence: 'fixed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const result = calculator.calculateTemplateTotals(lines);

      expect(result.remainingLivingAllowance).toBe(-500);
    });
  });

  describe('calculateBatchTotals', () => {
    it('should calculate totals for multiple templates', () => {
      const templatesWithLines = [
        {
          id: 'template1',
          lines: [
            {
              id: '1',
              templateId: 'template1',
              kind: 'income' as const,
              name: 'Salary',
              description: 'Monthly salary',
              amount: 5000,
              recurrence: 'fixed' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: 'template2',
          lines: [
            {
              id: '2',
              templateId: 'template2',
              kind: 'income' as const,
              name: 'Freelance',
              description: 'Freelance income',
              amount: 2000,
              recurrence: 'variable' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      ];

      const result = calculator.calculateBatchTotals(templatesWithLines);

      expect(result['template1'].totalIncome).toBe(5000);
      expect(result['template2'].totalIncome).toBe(2000);
    });

    it('should handle empty batch', () => {
      const result = calculator.calculateBatchTotals([]);

      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('createDefaultTotals', () => {
    it('should create default totals with loading true', () => {
      const result = calculator.createDefaultTotals(true);

      expect(result.totalIncome).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.totalSavings).toBe(0);
      expect(result.remainingLivingAllowance).toBe(0);
      expect(result.loading).toBe(true);
    });

    it('should create default totals with loading false', () => {
      const result = calculator.createDefaultTotals(false);

      expect(result.loading).toBe(false);
    });
  });
});
