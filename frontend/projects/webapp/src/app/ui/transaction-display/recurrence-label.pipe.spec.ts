import { describe, beforeEach, it, expect } from 'vitest';
import { RecurrenceLabelPipe } from './recurrence-label.pipe';
import type { TransactionRecurrence } from '@pulpe/shared';

describe('RecurrenceLabelPipe', () => {
  let pipe: RecurrenceLabelPipe;

  beforeEach(() => {
    pipe = new RecurrenceLabelPipe();
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return correct label for fixed', () => {
    expect(pipe.transform('fixed')).toBe('Récurrent');
  });

  it('should return correct label for one_off', () => {
    expect(pipe.transform('one_off')).toBe('Prévu');
  });

  it('should handle all TransactionRecurrence values', () => {
    const validRecurrences: TransactionRecurrence[] = ['fixed', 'one_off'];

    validRecurrences.forEach((recurrence) => {
      const result = pipe.transform(recurrence);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  it('should return Swiss French labels', () => {
    // Verify that labels follow Swiss French budget vocabulary
    expect(pipe.transform('fixed')).toBe('Récurrent'); // Monthly recurring expense
    expect(pipe.transform('one_off')).toBe('Prévu'); // Planned one-time expense
  });
});
