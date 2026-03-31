import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppCurrencyPipe } from './app-currency.pipe';

describe('AppCurrencyPipe', () => {
  let pipe: AppCurrencyPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), AppCurrencyPipe],
    });

    pipe = TestBed.inject(AppCurrencyPipe);
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  describe('CHF formatting', () => {
    it('should format with CHF symbol and de-CH locale', () => {
      const result = pipe.transform(1234.56, 'CHF');
      expect(result).toContain('CHF');
      expect(result).toContain('1');
      expect(result).toContain('234.56');
    });

    it('should use default digitsInfo (1.2-2)', () => {
      const result = pipe.transform(100, 'CHF');
      expect(result).toContain('100.00');
    });
  });

  describe('EUR formatting', () => {
    it('should format with EUR symbol and fr-FR locale', () => {
      const result = pipe.transform(1234.56, 'EUR');
      expect(result).toContain('€');
      expect(result).toContain('1');
      expect(result).toContain('234,56');
    });
  });

  describe('custom digitsInfo', () => {
    it('should apply custom digitsInfo', () => {
      const result = pipe.transform(1234, 'CHF', '1.0-0');
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).not.toContain('.00');
    });
  });

  describe('edge cases', () => {
    it('should return null for null input', () => {
      expect(pipe.transform(null, 'CHF')).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(pipe.transform(undefined, 'CHF')).toBeNull();
    });

    it('should handle zero', () => {
      const result = pipe.transform(0, 'CHF');
      expect(result).toContain('0.00');
    });

    it('should handle string numbers', () => {
      const result = pipe.transform('42.5', 'CHF');
      expect(result).toContain('42.50');
    });
  });

  describe('currency argument determines formatting', () => {
    it('should use CHF formatting when CHF is passed', () => {
      const result = pipe.transform(100, 'CHF');
      expect(result).toContain('CHF');
    });

    it('should use EUR formatting when EUR is passed', () => {
      const result = pipe.transform(100, 'EUR');
      expect(result).toContain('€');
    });
  });
});
