import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { UserSettingsApi } from '@core/user-settings';
import { AppCurrencyPipe } from './app-currency.pipe';

describe('AppCurrencyPipe', () => {
  let pipe: AppCurrencyPipe;
  let mockCurrency: ReturnType<typeof signal<string>>;

  beforeEach(() => {
    mockCurrency = signal('CHF');

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AppCurrencyPipe,
        {
          provide: UserSettingsApi,
          useValue: { currency: mockCurrency },
        },
      ],
    });

    pipe = TestBed.inject(AppCurrencyPipe);
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  describe('CHF formatting', () => {
    it('should format with CHF symbol and de-CH locale', () => {
      const result = pipe.transform(1234.56);
      expect(result).toContain('CHF');
      expect(result).toContain('1');
      expect(result).toContain('234.56');
    });

    it('should use default digitsInfo (1.2-2)', () => {
      const result = pipe.transform(100);
      expect(result).toContain('100.00');
    });
  });

  describe('EUR formatting', () => {
    beforeEach(() => {
      mockCurrency.set('EUR');
    });

    it('should format with EUR symbol and de-DE locale', () => {
      const result = pipe.transform(1234.56);
      expect(result).toContain('€');
      expect(result).toContain('1.234,56');
    });
  });

  describe('custom digitsInfo', () => {
    it('should apply custom digitsInfo', () => {
      const result = pipe.transform(1234, '1.0-0');
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).not.toContain('.00');
    });
  });

  describe('edge cases', () => {
    it('should return null for null input', () => {
      expect(pipe.transform(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(pipe.transform(undefined)).toBeNull();
    });

    it('should handle zero', () => {
      const result = pipe.transform(0);
      expect(result).toContain('0.00');
    });

    it('should handle string numbers', () => {
      const result = pipe.transform('42.5');
      expect(result).toContain('42.50');
    });
  });

  describe('reactive currency changes', () => {
    it('should reflect currency change on next transform call', () => {
      const chfResult = pipe.transform(100);
      expect(chfResult).toContain('CHF');

      mockCurrency.set('EUR');
      const eurResult = pipe.transform(100);
      expect(eurResult).toContain('€');
    });
  });
});
