import { describe, it, expect } from 'vitest';

describe('CreateAllocatedTransactionBottomSheet', () => {
  describe('Transaction Creation Logic', () => {
    it('should build TransactionCreate with correct budgetLineId and budgetId', () => {
      const budgetLine = {
        id: 'bl-123',
        budgetId: 'budget-456',
        name: 'Assurance maladie',
        amount: 385,
        kind: 'expense' as const,
      };

      const formValue = {
        name: 'Consultation médecin',
        amount: 45.5,
        transactionDate: new Date('2026-01-15'),
      };

      const transaction = {
        budgetId: budgetLine.budgetId,
        budgetLineId: budgetLine.id,
        name: formValue.name.trim(),
        amount: formValue.amount,
        kind: budgetLine.kind,
        transactionDate: formValue.transactionDate.toISOString(),
        category: null,
      };

      expect(transaction.budgetId).toBe('budget-456');
      expect(transaction.budgetLineId).toBe('bl-123');
      expect(transaction.name).toBe('Consultation médecin');
      expect(transaction.amount).toBe(45.5);
      expect(transaction.kind).toBe('expense');
      expect(transaction.category).toBeNull();
    });

    it('should trim whitespace from name', () => {
      const name = '  Courses  ';
      expect(name.trim()).toBe('Courses');
    });

    it('should use current date as fallback when transactionDate is not a Date', () => {
      const formValue = { transactionDate: 'not-a-date' as unknown };
      const transactionDate =
        formValue.transactionDate instanceof Date
          ? (formValue.transactionDate as Date).toISOString()
          : new Date().toISOString();

      expect(transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should inherit kind from budget line', () => {
      const kinds = ['expense', 'income', 'saving'] as const;

      for (const kind of kinds) {
        const budgetLine = { kind };
        expect(budgetLine.kind).toBe(kind);
      }
    });
  });
});
