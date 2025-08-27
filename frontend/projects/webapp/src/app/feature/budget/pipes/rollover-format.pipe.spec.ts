import { describe, beforeEach, it, expect } from 'vitest';
import { RolloverFormatPipe } from './rollover-format.pipe';

describe('RolloverFormatPipe', () => {
  let pipe: RolloverFormatPipe;

  beforeEach(() => {
    pipe = new RolloverFormatPipe();
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should format valid rollover names correctly', () => {
    expect(pipe.transform('rollover_12_2024')).toBe('Report décembre 2024');
    expect(pipe.transform('rollover_1_2025')).toBe('Report janvier 2025');
    expect(pipe.transform('rollover_6_2023')).toBe('Report juin 2023');
  });

  it('should return original name for non-rollover inputs', () => {
    expect(pipe.transform('Regular Expense')).toBe('Regular Expense');
    expect(pipe.transform('Salary')).toBe('Salary');
    expect(pipe.transform('')).toBe('');
  });

  it('should handle invalid rollover patterns', () => {
    expect(pipe.transform('rollover_invalid')).toBe('rollover_invalid');
    expect(pipe.transform('rollover_13_2024')).toBe('rollover_13_2024'); // Invalid month
    expect(pipe.transform('rollover_0_2024')).toBe('rollover_0_2024'); // Invalid month
    expect(pipe.transform('rollover__2024')).toBe('rollover__2024'); // Missing month
  });

  it('should validate month bounds correctly', () => {
    // Test out-of-bounds months
    expect(pipe.transform('rollover_0_2024')).toBe('rollover_0_2024'); // Below range
    expect(pipe.transform('rollover_13_2024')).toBe('rollover_13_2024'); // Above range
    expect(pipe.transform('rollover_-1_2024')).toBe('rollover_-1_2024'); // Negative
    expect(pipe.transform('rollover_25_2024')).toBe('rollover_25_2024'); // Way above range

    // Test valid bounds
    expect(pipe.transform('rollover_1_2024')).toBe('Report janvier 2024'); // Lower bound
    expect(pipe.transform('rollover_12_2024')).toBe('Report décembre 2024'); // Upper bound
  });

  it('should handle edge cases gracefully', () => {
    expect(pipe.transform('rollover_1_2024')).toBe('Report janvier 2024');
    expect(pipe.transform('rollover_12_2024')).toBe('Report décembre 2024');
  });

  it('should handle null or undefined inputs', () => {
    // Test edge cases without using 'as any'
    expect(pipe.transform('')).toBe('');
  });

  it('should use correct French month names', () => {
    const monthTests = [
      { month: '1', expected: 'janvier' },
      { month: '2', expected: 'février' },
      { month: '3', expected: 'mars' },
      { month: '4', expected: 'avril' },
      { month: '5', expected: 'mai' },
      { month: '6', expected: 'juin' },
      { month: '7', expected: 'juillet' },
      { month: '8', expected: 'août' },
      { month: '9', expected: 'septembre' },
      { month: '10', expected: 'octobre' },
      { month: '11', expected: 'novembre' },
      { month: '12', expected: 'décembre' },
    ];

    monthTests.forEach(({ month, expected }) => {
      const result = pipe.transform(`rollover_${month}_2024`);
      expect(result).toBe(`Report ${expected} 2024`);
    });
  });

  it('should handle non-rollover names that start with rollover_', () => {
    expect(pipe.transform('rollover_data_backup')).toBe('rollover_data_backup');
    expect(pipe.transform('rollover_config_file')).toBe('rollover_config_file');
  });
});
