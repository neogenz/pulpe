import { describe, beforeEach, it, expect } from 'vitest';
import { TransactionLabelPipe } from './transaction-label.pipe';
import type { TransactionKind } from '@pulpe/shared';

describe('TransactionLabelPipe', () => {
  let pipe: TransactionLabelPipe;

  beforeEach(() => {
    pipe = new TransactionLabelPipe();
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return correct label for income', () => {
    expect(pipe.transform('income')).toBe('Revenu');
  });

  it('should return correct label for expense', () => {
    expect(pipe.transform('expense')).toBe('Dépense');
  });

  it('should return correct label for saving', () => {
    expect(pipe.transform('saving')).toBe('Épargne');
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

  it('should return French labels', () => {
    // Verify that all labels are in French
    expect(pipe.transform('income')).toMatch(/revenu/i);
    expect(pipe.transform('expense')).toMatch(/dépense/i);
    expect(pipe.transform('saving')).toMatch(/épargne/i);
  });
});
