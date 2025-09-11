import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { RolloverFormatPipe } from './rollover-format.pipe';

describe('RolloverFormatPipe (UI)', () => {
  let pipe: RolloverFormatPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });

    pipe = TestBed.runInInjectionContext(() => new RolloverFormatPipe());
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

  it('should validate month bounds correctly', () => {
    expect(pipe.transform('rollover_0_2024')).toBe('rollover_0_2024');
    expect(pipe.transform('rollover_13_2024')).toBe('rollover_13_2024');
    expect(pipe.transform('rollover_-1_2024')).toBe('rollover_-1_2024');
    expect(pipe.transform('rollover_25_2024')).toBe('rollover_25_2024');
    expect(pipe.transform('rollover_1_2024')).toBe('Report janvier 2024');
    expect(pipe.transform('rollover_12_2024')).toBe('Report décembre 2024');
  });

  it('should handle names that start with rollover_ but are not valid patterns', () => {
    expect(pipe.transform('rollover_invalid')).toBe('rollover_invalid');
    expect(pipe.transform('rollover_data_backup')).toBe('rollover_data_backup');
  });
});
