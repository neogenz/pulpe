import { describe, it, expect } from 'bun:test';
import { BudgetLineInvariants } from './budget-line.invariants';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetLineCreate, BudgetLineUpdate } from 'pulpe-shared';
import type { SpreadSourceLine } from './budget-line.entity';

const spreadSourceLine = (
  overrides: Partial<SpreadSourceLine> = {},
): SpreadSourceLine => ({
  id: 'line-1',
  budgetId: 'budget-1',
  month: 3,
  year: 2026,
  name: 'Assurance',
  amount: 300,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'one_off',
  spreadGroupId: null,
  ...overrides,
});

describe('BudgetLineInvariants', () => {
  describe('validateCreate', () => {
    it('should throw when budgetId is missing', () => {
      const dto = {
        name: 'Test',
        amount: 100,
        kind: 'expense',
        recurrence: 'fixed',
      } as BudgetLineCreate;

      expect(() => BudgetLineInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when amount is negative', () => {
      const dto = {
        budgetId: 'budget-1',
        name: 'Test',
        amount: -1,
        kind: 'expense',
        recurrence: 'fixed',
      } as BudgetLineCreate;

      expect(() => BudgetLineInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should accept amount of zero', () => {
      const dto = {
        budgetId: 'budget-1',
        name: 'Test',
        amount: 0,
        kind: 'expense',
        recurrence: 'fixed',
      } as BudgetLineCreate;

      expect(() => BudgetLineInvariants.validateCreate(dto)).not.toThrow();
    });

    it('should throw when amount is missing', () => {
      const dto = {
        budgetId: 'budget-1',
        name: 'Test',
        kind: 'expense',
        recurrence: 'fixed',
      } as unknown as BudgetLineCreate;

      expect(() => BudgetLineInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when name is empty', () => {
      const dto = {
        budgetId: 'budget-1',
        name: '   ',
        amount: 100,
        kind: 'expense',
        recurrence: 'fixed',
      } as BudgetLineCreate;

      expect(() => BudgetLineInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should not throw for valid create data', () => {
      const dto = {
        budgetId: 'budget-1',
        name: 'Loyer',
        amount: 1200,
        kind: 'expense',
        recurrence: 'fixed',
      } as BudgetLineCreate;

      expect(() => BudgetLineInvariants.validateCreate(dto)).not.toThrow();
    });
  });

  describe('validateUpdate', () => {
    it('should throw when amount is negative', () => {
      const dto = { amount: -10 } as BudgetLineUpdate;

      expect(() => BudgetLineInvariants.validateUpdate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when name is empty string', () => {
      const dto = { name: '' } as BudgetLineUpdate;

      expect(() => BudgetLineInvariants.validateUpdate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should not throw when amount is zero', () => {
      const dto = { amount: 0 } as BudgetLineUpdate;

      expect(() => BudgetLineInvariants.validateUpdate(dto)).not.toThrow();
    });

    it('should not throw for valid partial update', () => {
      const dto = { name: 'Nouveau nom', amount: 500 } as BudgetLineUpdate;

      expect(() => BudgetLineInvariants.validateUpdate(dto)).not.toThrow();
    });
  });

  describe('validateTemplateLineIdExists', () => {
    it('should throw when templateLineId is null', () => {
      expect(() =>
        BudgetLineInvariants.validateTemplateLineIdExists(null),
      ).toThrow(BusinessException);
    });

    it('should not throw when templateLineId is a valid string', () => {
      expect(() =>
        BudgetLineInvariants.validateTemplateLineIdExists(
          '123e4567-e89b-12d3-a456-426614174000',
        ),
      ).not.toThrow();
    });
  });

  describe('validateSpreadFromLineSource', () => {
    it('rejects a zero-amount line (clean 400, not a 500 from splitTotalPreserving)', () => {
      expect(() =>
        BudgetLineInvariants.validateSpreadFromLineSource(
          spreadSourceLine({ amount: 0 }),
        ),
      ).toThrow(BusinessException);
    });

    it('rejects a line already part of a spread group', () => {
      expect(() =>
        BudgetLineInvariants.validateSpreadFromLineSource(
          spreadSourceLine({ spreadGroupId: 'grp-1' }),
        ),
      ).toThrow(BusinessException);
    });

    it('accepts a positive one-off expense line', () => {
      expect(() =>
        BudgetLineInvariants.validateSpreadFromLineSource(spreadSourceLine()),
      ).not.toThrow();
    });
  });
});
