import { describe, it, expect } from 'bun:test';
import { TransactionInvariants } from './transaction.invariants';
import { BusinessException } from '@common/exceptions/business.exception';
import type { TransactionCreate, TransactionUpdate } from 'pulpe-shared';
import type { SpreadSourceTransaction } from './transaction.entity';

const spreadSourceTransaction = (
  overrides: Partial<SpreadSourceTransaction> = {},
): SpreadSourceTransaction => ({
  id: 'txn-1',
  budgetId: 'budget-1',
  userId: 'user-1',
  budgetLineId: null,
  month: 3,
  year: 2026,
  name: 'Resto',
  amount: 120,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  ...overrides,
});

describe('TransactionInvariants', () => {
  describe('validateCreate', () => {
    it('should throw when budgetId is missing', () => {
      const dto = {
        name: 'Resto',
        amount: 50,
        kind: 'expense',
      } as TransactionCreate;

      expect(() => TransactionInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when amount is zero', () => {
      const dto = {
        budgetId: 'budget-1',
        name: 'Resto',
        amount: 0,
        kind: 'expense',
      } as TransactionCreate;

      expect(() => TransactionInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when amount is negative', () => {
      const dto = {
        budgetId: 'budget-1',
        name: 'Resto',
        amount: -10,
        kind: 'expense',
      } as TransactionCreate;

      expect(() => TransactionInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when amount exceeds max', () => {
      const dto = {
        budgetId: 'budget-1',
        name: 'Resto',
        amount: 1000001,
        kind: 'expense',
      } as TransactionCreate;

      expect(() => TransactionInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when name is empty', () => {
      const dto = {
        budgetId: 'budget-1',
        name: '   ',
        amount: 50,
        kind: 'expense',
      } as TransactionCreate;

      expect(() => TransactionInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when name exceeds max length', () => {
      const dto = {
        budgetId: 'budget-1',
        name: 'a'.repeat(101),
        amount: 50,
        kind: 'expense',
      } as TransactionCreate;

      expect(() => TransactionInvariants.validateCreate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should not throw for valid create data', () => {
      const dto = {
        budgetId: 'budget-1',
        name: 'Restaurant',
        amount: 50,
        kind: 'expense',
        transactionDate: '2024-01-15',
      } as TransactionCreate;

      expect(() => TransactionInvariants.validateCreate(dto)).not.toThrow();
    });
  });

  describe('validateUpdate', () => {
    it('should throw when amount is zero or negative', () => {
      const dto = { amount: 0 } as TransactionUpdate;

      expect(() => TransactionInvariants.validateUpdate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when amount exceeds max', () => {
      const dto = { amount: 1000001 } as TransactionUpdate;

      expect(() => TransactionInvariants.validateUpdate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when name is empty string', () => {
      const dto = { name: '' } as TransactionUpdate;

      expect(() => TransactionInvariants.validateUpdate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should throw when name exceeds max length', () => {
      const dto = { name: 'a'.repeat(101) } as TransactionUpdate;

      expect(() => TransactionInvariants.validateUpdate(dto)).toThrow(
        BusinessException,
      );
    });

    it('should not throw for valid partial update', () => {
      const dto = { name: 'New name', amount: 100 } as TransactionUpdate;

      expect(() => TransactionInvariants.validateUpdate(dto)).not.toThrow();
    });

    it('should not throw when no fields are provided', () => {
      const dto = {} as TransactionUpdate;

      expect(() => TransactionInvariants.validateUpdate(dto)).not.toThrow();
    });
  });

  describe('validateSpreadFromTransactionSource', () => {
    it('rejects a zero-amount transaction (clean 400, not a 500 from splitTotalPreserving)', () => {
      expect(() =>
        TransactionInvariants.validateSpreadFromTransactionSource(
          spreadSourceTransaction({ amount: 0 }),
        ),
      ).toThrow(BusinessException);
    });

    it('rejects an allocated transaction', () => {
      expect(() =>
        TransactionInvariants.validateSpreadFromTransactionSource(
          spreadSourceTransaction({ budgetLineId: 'line-1' }),
        ),
      ).toThrow(BusinessException);
    });

    it('accepts a positive free expense transaction', () => {
      expect(() =>
        TransactionInvariants.validateSpreadFromTransactionSource(
          spreadSourceTransaction(),
        ),
      ).not.toThrow();
    });
  });
});
