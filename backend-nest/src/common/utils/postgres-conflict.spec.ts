import { describe, expect, it } from 'bun:test';
import { isRetryableTransactionConflict } from './postgres-conflict';

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
