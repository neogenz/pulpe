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
    expect(pipe.transform('fixed')).toBe('Tous les mois');
  });

  it('should return correct label for one_off', () => {
    expect(pipe.transform('one_off')).toBe('Une seule fois');
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

  it('should return French labels', () => {
    // Verify that labels follow French business vocabulary
    expect(pipe.transform('fixed')).toBe('Tous les mois'); // Not "Fixe" or "Récurrent"
    expect(pipe.transform('one_off')).toBe('Une seule fois'); // Not "Unique" or "Ponctuel"
  });
});
