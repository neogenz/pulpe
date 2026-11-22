import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENTS } from './feature-flags.js';

// The iOS mirror (AnalyticsEvent.swift) hardcodes the same strings; a rename
// here alone would split the web and Android series from the iOS one.
describe('ANALYTICS_EVENTS guide names', () => {
  it('keeps the comparison guide event names shared with iOS', () => {
    expect(ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_VIEWED).toBe(
      'account_reconciliation_guide_viewed',
    );
    expect(ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_COMPLETED).toBe(
      'account_reconciliation_guide_completed',
    );
    expect(ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_SKIPPED).toBe(
      'account_reconciliation_guide_skipped',
    );
  });
});
