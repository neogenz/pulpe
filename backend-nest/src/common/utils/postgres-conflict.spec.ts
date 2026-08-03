import { describe, expect, it } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  isRetryableTransactionConflict,
  throwIfRetryableConflict,
} from './postgres-conflict';

describe('isRetryableTransactionConflict', () => {
  it('should recognize a deadlock the engine arbitrated', () => {
    const result = isRetryableTransactionConflict({
      code: '40P01',
      message: 'deadlock detected',
    });

    expect(result).toBe(true);
  });

  it('should recognize a serialization failure', () => {
    const result = isRetryableTransactionConflict({
      code: '40001',
      message: 'could not serialize access',
    });

    expect(result).toBe(true);
  });

  it('should not claim an application revision conflict', () => {
    const result = isRetryableTransactionConflict({
      code: 'P0001',
      message: 'Savings goal balance changed',
    });

    expect(result).toBe(false);
  });

  it('should leave the rest of class 40 to the caller, whose replay is unsafe', () => {
    expect(isRetryableTransactionConflict({ code: '40002' })).toBe(false);
    expect(isRetryableTransactionConflict({ code: '40003' })).toBe(false);
  });

  it('should tolerate an error of any unexpected shape', () => {
    expect(isRetryableTransactionConflict(null)).toBe(false);
    expect(isRetryableTransactionConflict(undefined)).toBe(false);
    expect(isRetryableTransactionConflict('40P01')).toBe(false);
    expect(isRetryableTransactionConflict({})).toBe(false);
  });
});

describe('throwIfRetryableConflict', () => {
  it('should turn an arbitrated deadlock into a conflict the client replays', () => {
    try {
      throwIfRetryableConflict({ code: '40P01' }, 'budget_line', {
        operation: 'updateBudgetLine',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe('ERR_CONCURRENT_MODIFICATION');
      expect(businessError.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(businessError.details).toEqual({ resource: 'budget_line' });
    }
  });

  it('should let every other failure reach its own handler untouched', () => {
    expect(() =>
      throwIfRetryableConflict({ code: 'PGRST116' }, 'transaction', {}),
    ).not.toThrow();
    expect(() =>
      throwIfRetryableConflict(null, 'transaction', {}),
    ).not.toThrow();
  });
});
