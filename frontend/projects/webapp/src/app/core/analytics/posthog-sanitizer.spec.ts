import { describe, expect, it } from 'vitest';

import { sanitizeRecord, sanitizeUrl } from '@core/analytics';

describe('posthog-sanitizer', () => {
  describe('sanitizeUrl', () => {
    it('removes protected parameters and masks dynamic segments for absolute URLs', () => {
      const sanitized = sanitizeUrl(
        'https://app.local/budgets/123?token=abc&keep=1#details',
      );

      expect(sanitized).toBe('https://app.local/budget/[id]?keep=1#details');
    });

    it('preserves protocol-relative URLs while stripping protected parameters', () => {
      const sanitized = sanitizeUrl('//cdn.example.com/assets?token=abc');

      expect(sanitized).toBe('//cdn.example.com/assets');
    });

    it('sanitizes relative URLs using the dynamic segment masks', () => {
      const sanitized = sanitizeUrl('/transactions/456?transactionId=789');

      expect(sanitized).toBe('/transaction/[id]');
    });
  });

  describe('sanitizeRecord', () => {
    it('filters sensitive fields while keeping safe properties', () => {
      const sanitized = sanitizeRecord({
        apiKey: 'secret',
        amount: 1200,
        journeyKey: 'stay-visible',
        profileUrl: '/budgets/999?token=abc',
      });

      expect(sanitized).toEqual({
        journeyKey: 'stay-visible',
        profileUrl: '/budget/[id]',
      });
    });
  });
});
