import { describe, beforeEach, it, expect } from 'vitest';
import { TransactionIconPipe } from './transaction-icon.pipe';
import type { TransactionKind } from '@pulpe/shared';

describe('TransactionIconPipe', () => {
  let pipe: TransactionIconPipe;

  beforeEach(() => {
    pipe = new TransactionIconPipe();
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return correct icon for income', () => {
    expect(pipe.transform('income')).toBe('arrow_upward');
  });

  it('should return correct icon for expense', () => {
    expect(pipe.transform('expense')).toBe('arrow_downward');
  });

  it('should return correct icon for saving', () => {
    expect(pipe.transform('saving')).toBe('savings');
  });

  it('should handle all TransactionKind values', () => {
    const validKinds: TransactionKind[] = ['income', 'expense', 'saving'];

    validKinds.forEach((kind) => {
      const result = pipe.transform(kind);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
