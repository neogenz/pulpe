import { describe, it, expect } from 'vitest';
import { formatRolloverDisplayName } from './rollover-types';

describe('formatRolloverDisplayName', () => {
  it('should format valid rollover names correctly', () => {
    expect(formatRolloverDisplayName('rollover_12_2024')).toBe(
      'Report décembre 2024',
    );
    expect(formatRolloverDisplayName('rollover_1_2025')).toBe(
      'Report janvier 2025',
    );
    expect(formatRolloverDisplayName('rollover_6_2023')).toBe(
      'Report juin 2023',
    );
  });

  it('should return original name for non-rollover inputs', () => {
    expect(formatRolloverDisplayName('Regular Expense')).toBe(
      'Regular Expense',
    );
    expect(formatRolloverDisplayName('Salary')).toBe('Salary');
    expect(formatRolloverDisplayName('')).toBe('');
  });

  it('should validate month bounds correctly', () => {
    expect(formatRolloverDisplayName('rollover_0_2024')).toBe(
      'rollover_0_2024',
    );
    expect(formatRolloverDisplayName('rollover_13_2024')).toBe(
      'rollover_13_2024',
    );
    expect(formatRolloverDisplayName('rollover_-1_2024')).toBe(
      'rollover_-1_2024',
    );
    expect(formatRolloverDisplayName('rollover_25_2024')).toBe(
      'rollover_25_2024',
    );
    expect(formatRolloverDisplayName('rollover_1_2024')).toBe(
      'Report janvier 2024',
    );
    expect(formatRolloverDisplayName('rollover_12_2024')).toBe(
      'Report décembre 2024',
    );
  });

  it('should handle names that start with rollover_ but are not valid patterns', () => {
    expect(formatRolloverDisplayName('rollover_invalid')).toBe(
      'rollover_invalid',
    );
    expect(formatRolloverDisplayName('rollover_data_backup')).toBe(
      'rollover_data_backup',
    );
  });
});
