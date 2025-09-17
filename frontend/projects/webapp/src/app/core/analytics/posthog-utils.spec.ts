import { describe, it, expect } from 'vitest';
import {
  sanitizeFinancialString,
  isFinancialKey,
  maskEmail,
  deepSanitizeFinancialData,
  toJsonType,
  isSensitiveKey,
  getFinancialMaskSelectors,
  FINANCIAL_PATTERNS,
  FINANCIAL_KEY_PATTERNS,
  SENSITIVE_KEY_PATTERNS,
} from './posthog-utils';

describe('PostHog Utils', () => {
  describe('sanitizeFinancialString', () => {
    it('should mask CHF amounts with prefix', () => {
      expect(sanitizeFinancialString('CHF 1,234.50')).toBe('CHF ***');
      expect(sanitizeFinancialString('CHF 1234.50')).toBe('CHF ***');
      expect(sanitizeFinancialString('CHF 1 234.50')).toBe('CHF ***');
    });

    it('should mask CHF amounts with suffix', () => {
      expect(sanitizeFinancialString('1234.50 CHF')).toBe('*** CHF');
      expect(sanitizeFinancialString('1,234.50 CHF')).toBe('*** CHF');
      expect(sanitizeFinancialString('1 234.50 CHF')).toBe('*** CHF');
    });

    it('should mask Swiss number formatting', () => {
      expect(sanitizeFinancialString("1'234.50")).toBe('***');
      expect(sanitizeFinancialString("1'234,50")).toBe('***');
      expect(sanitizeFinancialString("12'345'678.90")).toBe('***');
    });

    it('should mask decimal amounts', () => {
      expect(sanitizeFinancialString('123.45')).toBe('***');
      expect(sanitizeFinancialString('999.99')).toBe('***');
      expect(sanitizeFinancialString('0.50')).toBe('***');
    });

    it('should mask percentages', () => {
      expect(sanitizeFinancialString('15%')).toBe('***%');
      expect(sanitizeFinancialString('100.5%')).toBe('***%');
      expect(sanitizeFinancialString('0%')).toBe('***%');
    });

    it('should mask large numbers', () => {
      // Large numbers (4+ digits) are masked by LARGE_NUMBER pattern
      expect(sanitizeFinancialString('1234')).toBe('***');
      expect(sanitizeFinancialString('999999')).toBe('***'); // Masked by LARGE_NUMBER
      expect(sanitizeFinancialString('10000')).toBe('***'); // Masked by LARGE_NUMBER
    });

    it('should handle mixed content', () => {
      expect(
        sanitizeFinancialString('Total: CHF 1,234.50 and 15% discount'),
      ).toBe('Total:*** CHF ***and ***% discount');
    });

    it('should not mask regular text', () => {
      expect(sanitizeFinancialString('Hello world')).toBe('Hello world');
      expect(sanitizeFinancialString('User clicked button')).toBe(
        'User clicked button',
      );
    });
  });

  describe('isFinancialKey', () => {
    it('should detect financial keys in English', () => {
      expect(isFinancialKey('amount')).toBe(true);
      expect(isFinancialKey('total_amount')).toBe(true);
      expect(isFinancialKey('balance')).toBe(true);
      expect(isFinancialKey('price')).toBe(true);
      expect(isFinancialKey('cost')).toBe(true);
      expect(isFinancialKey('value')).toBe(true);
      expect(isFinancialKey('payment')).toBe(true);
      expect(isFinancialKey('revenue')).toBe(true);
      expect(isFinancialKey('income')).toBe(true);
      expect(isFinancialKey('expense')).toBe(true);
      expect(isFinancialKey('budget')).toBe(true);
      expect(isFinancialKey('saving')).toBe(true);
    });

    it('should detect financial keys in French', () => {
      expect(isFinancialKey('montant')).toBe(true);
      expect(isFinancialKey('solde')).toBe(true);
      expect(isFinancialKey('depense')).toBe(true);
      expect(isFinancialKey('revenu')).toBe(true);
    });

    it('should not detect non-financial keys', () => {
      expect(isFinancialKey('username')).toBe(false);
      expect(isFinancialKey('email')).toBe(false);
      expect(isFinancialKey('name')).toBe(false);
      expect(isFinancialKey('id')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isFinancialKey('AMOUNT')).toBe(true);
      expect(isFinancialKey('Total_Amount')).toBe(true);
      expect(isFinancialKey('MONTANT')).toBe(true);
    });
  });

  describe('isSensitiveKey', () => {
    it('should detect sensitive keys', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('key')).toBe(true);
      expect(isSensitiveKey('secret')).toBe(true);
      expect(isSensitiveKey('auth')).toBe(true);
      expect(isSensitiveKey('credential')).toBe(true);
      expect(isSensitiveKey('credit_card')).toBe(true);
      expect(isSensitiveKey('ssn')).toBe(true);
      expect(isSensitiveKey('social_security')).toBe(true);
    });

    it('should not detect non-sensitive keys', () => {
      expect(isSensitiveKey('username')).toBe(false);
      expect(isSensitiveKey('email')).toBe(false);
      expect(isSensitiveKey('name')).toBe(false);
      expect(isSensitiveKey('amount')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isSensitiveKey('PASSWORD')).toBe(true);
      expect(isSensitiveKey('Api_Token')).toBe(true);
    });
  });

  describe('maskEmail', () => {
    it('should mask email addresses preserving domain', () => {
      expect(maskEmail('john.doe@example.com')).toBe('jo***@example.com');
      expect(maskEmail('test@example.com')).toBe('te***@example.com');
      expect(maskEmail('a@b.com')).toBe('***@b.com');
    });

    it('should handle short local parts', () => {
      expect(maskEmail('a@test.com')).toBe('***@test.com');
      expect(maskEmail('ab@test.com')).toBe('***@test.com');
    });

    it('should handle invalid emails', () => {
      expect(maskEmail('invalid-email')).toBe('[REDACTED]');
      expect(maskEmail('@domain.com')).toBe('[REDACTED]');
      expect(maskEmail('local@')).toBe('[REDACTED]');
      expect(maskEmail('')).toBe('[REDACTED]');
    });

    it('should handle edge cases', () => {
      expect(maskEmail('user@sub.domain.com')).toBe('us***@sub.domain.com');
      expect(maskEmail('test.email+tag@gmail.com')).toBe('te***@gmail.com');
    });
  });

  describe('toJsonType', () => {
    it('should handle primitive types', () => {
      expect(toJsonType(null)).toBe(null);
      expect(toJsonType(undefined)).toBe(undefined);
      expect(toJsonType('string')).toBe('string');
      expect(toJsonType(123)).toBe(123);
      expect(toJsonType(true)).toBe(true);
    });

    it('should handle arrays', () => {
      expect(toJsonType([1, 2, 3])).toEqual([1, 2, 3]);
      expect(toJsonType(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
      expect(toJsonType([1, 'string', true])).toEqual([1, 'string', true]);
    });

    it('should handle objects', () => {
      const obj = { a: 1, b: 'string', c: true };
      expect(toJsonType(obj)).toEqual(obj);
    });

    it('should handle nested structures', () => {
      const nested = { arr: [1, 2], obj: { nested: 'value' } };
      expect(toJsonType(nested)).toEqual(nested);
    });

    it('should convert unknown types to string', () => {
      expect(toJsonType(Symbol('test'))).toBe('[Symbol: test]');
      expect(toJsonType(Symbol())).toBe('[Symbol: unknown]');
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      expect(toJsonType(function testFunction() {})).toBe('[Function]');
      const dateResult = toJsonType(new Date('2025-01-01T00:00:00.000Z'));
      expect(typeof dateResult).toBe('string'); // Date objects are converted to ISO string
      expect(dateResult).toBe('2025-01-01T00:00:00.000Z'); // Should be ISO string
    });
  });

  describe('deepSanitizeFinancialData', () => {
    it('should handle null and undefined', () => {
      expect(deepSanitizeFinancialData(null)).toBe(null);
      expect(deepSanitizeFinancialData(undefined)).toBe(undefined);
    });

    it('should sanitize strings', () => {
      expect(deepSanitizeFinancialData('CHF 123.45')).toBe('CHF ***');
      expect(deepSanitizeFinancialData('Total: 999.99')).toBe('Total: ***');
    });

    it('should preserve all numbers (amounts should not be sent to PostHog)', () => {
      // New philosophy: Numbers are left as-is because we shouldn't send
      // financial amounts to PostHog anyway. If amounts are sent, it's an
      // app-level issue, not a sanitization issue.
      expect(deepSanitizeFinancialData(123.45)).toBe(123.45);
      expect(deepSanitizeFinancialData(999.99)).toBe(999.99);
      expect(deepSanitizeFinancialData(0.5)).toBe(0.5);
      expect(deepSanitizeFinancialData(1234)).toBe(1234);
      expect(deepSanitizeFinancialData(999999)).toBe(999999);
      expect(deepSanitizeFinancialData(15000)).toBe(15000);
      expect(deepSanitizeFinancialData(5)).toBe(5);
      expect(deepSanitizeFinancialData(99)).toBe(99);
      expect(deepSanitizeFinancialData(2024)).toBe(2024); // Years preserved
    });

    it('should sanitize arrays', () => {
      expect(deepSanitizeFinancialData([123.45, 'CHF 999', 5])).toEqual([
        123.45, // Numbers are preserved
        'CHF ***', // Strings with CHF are masked
        5,
      ]);
    });

    it('should sanitize objects with financial keys', () => {
      const obj = {
        amount: 123.45,
        balance: 'CHF 999',
        username: 'john',
        count: 5,
      };
      expect(deepSanitizeFinancialData(obj)).toEqual({
        amount: '***',
        balance: '***', // balance is a financial key, so entire value is masked
        username: 'john',
        count: 5,
      });
    });

    it('should handle nested objects', () => {
      const nested = {
        user: {
          balance: 123.45,
          name: 'John',
        },
        transactions: [
          { amount: 50.0, description: 'Payment' },
          { amount: 25.5, description: 'Refund' },
        ],
      };
      expect(deepSanitizeFinancialData(nested)).toEqual({
        user: {
          balance: '***',
          name: 'John',
        },
        transactions: [
          { amount: '***', description: 'Payment' },
          { amount: '***', description: 'Refund' },
        ],
      });
    });

    it('should preserve boolean values', () => {
      expect(deepSanitizeFinancialData(true)).toBe(true);
      expect(deepSanitizeFinancialData(false)).toBe(false);
    });
  });

  describe('getFinancialMaskSelectors', () => {
    it('should return CSS selectors for financial elements', () => {
      const selectors = getFinancialMaskSelectors();
      expect(selectors).toContain('.financial-amount');
      expect(selectors).toContain('.financial-title');
      expect(selectors).toContain('[class*="financial"]');
      expect(selectors).toContain('[class*="amount"]');
      expect(selectors).toContain('[class*="balance"]');
      expect(selectors).toContain('[class*="total"]');
      expect(selectors).toContain('[data-financial]');
      expect(selectors).toContain('input[type="number"]');
    });

    it('should return selectors separated by commas', () => {
      const selectors = getFinancialMaskSelectors();
      expect(selectors).toMatch(/,\s*/g); // Contains commas with optional spaces
    });
  });

  describe('FINANCIAL_PATTERNS', () => {
    it('should contain all required patterns', () => {
      expect(FINANCIAL_PATTERNS.CHF_PREFIX).toBeInstanceOf(RegExp);
      expect(FINANCIAL_PATTERNS.CHF_SUFFIX).toBeInstanceOf(RegExp);
      expect(FINANCIAL_PATTERNS.SWISS_NUMBER).toBeInstanceOf(RegExp);
      expect(FINANCIAL_PATTERNS.DECIMAL_AMOUNT).toBeInstanceOf(RegExp);
      expect(FINANCIAL_PATTERNS.PERCENTAGE).toBeInstanceOf(RegExp);
      expect(FINANCIAL_PATTERNS.LARGE_NUMBER).toBeInstanceOf(RegExp);
    });

    it('should have case insensitive flags where appropriate', () => {
      expect(FINANCIAL_PATTERNS.CHF_PREFIX.flags).toContain('i');
      expect(FINANCIAL_PATTERNS.CHF_SUFFIX.flags).toContain('i');
    });
  });

  describe('FINANCIAL_KEY_PATTERNS', () => {
    it('should be an array of regex patterns', () => {
      expect(Array.isArray(FINANCIAL_KEY_PATTERNS)).toBe(true);
      FINANCIAL_KEY_PATTERNS.forEach((pattern) => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });

    it('should contain expected patterns', () => {
      const patternStrings = FINANCIAL_KEY_PATTERNS.map((p) => p.source);
      expect(patternStrings).toContain('amount');
      expect(patternStrings).toContain('montant');
      expect(patternStrings).toContain('balance');
      expect(patternStrings).toContain('solde');
    });
  });

  describe('SENSITIVE_KEY_PATTERNS', () => {
    it('should be an array of regex patterns', () => {
      expect(Array.isArray(SENSITIVE_KEY_PATTERNS)).toBe(true);
      SENSITIVE_KEY_PATTERNS.forEach((pattern) => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });

    it('should contain expected patterns', () => {
      const patternStrings = SENSITIVE_KEY_PATTERNS.map((p) => p.source);
      expect(patternStrings).toContain('password');
      expect(patternStrings).toContain('token');
      expect(patternStrings).toContain('secret');
    });
  });
});
