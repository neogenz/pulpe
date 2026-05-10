import { describe, it, expect } from 'bun:test';
import { AccountDeletionInvariants } from './account-deletion.invariants';
import { GRACE_PERIOD_DAYS } from './account-deletion.entity';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('AccountDeletionInvariants', () => {
  describe('parseScheduledDate', () => {
    it('returns null for undefined input', () => {
      expect(
        AccountDeletionInvariants.parseScheduledDate(undefined),
      ).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(AccountDeletionInvariants.parseScheduledDate('')).toBeNull();
    });

    it('returns null for an unparseable date string', () => {
      expect(
        AccountDeletionInvariants.parseScheduledDate('not-a-date'),
      ).toBeNull();
    });

    it('returns null for a syntactically date-shaped but invalid string', () => {
      expect(
        AccountDeletionInvariants.parseScheduledDate('2025-13-45'),
      ).toBeNull();
    });

    it('parses a valid ISO string', () => {
      const iso = '2026-01-15T10:00:00.000Z';
      const result = AccountDeletionInvariants.parseScheduledDate(iso);
      expect(result?.toISOString()).toBe(iso);
    });
  });

  describe('isGracePeriodExpired', () => {
    const now = new Date('2026-05-08T12:00:00.000Z');

    it('returns true when scheduledAt is older than the grace period', () => {
      const scheduledAt = new Date(
        now.getTime() - (GRACE_PERIOD_DAYS + 1) * MS_PER_DAY,
      );
      expect(
        AccountDeletionInvariants.isGracePeriodExpired(scheduledAt, now),
      ).toBe(true);
    });

    it('returns true at exactly the grace period boundary', () => {
      const scheduledAt = new Date(
        now.getTime() - GRACE_PERIOD_DAYS * MS_PER_DAY,
      );
      expect(
        AccountDeletionInvariants.isGracePeriodExpired(scheduledAt, now),
      ).toBe(true);
    });

    it('returns false 1 second before the boundary', () => {
      const scheduledAt = new Date(
        now.getTime() - GRACE_PERIOD_DAYS * MS_PER_DAY + 1000,
      );
      expect(
        AccountDeletionInvariants.isGracePeriodExpired(scheduledAt, now),
      ).toBe(false);
    });

    it('returns false when scheduledAt is recent', () => {
      const scheduledAt = new Date(now.getTime() - 1 * MS_PER_DAY);
      expect(
        AccountDeletionInvariants.isGracePeriodExpired(scheduledAt, now),
      ).toBe(false);
    });
  });
});
