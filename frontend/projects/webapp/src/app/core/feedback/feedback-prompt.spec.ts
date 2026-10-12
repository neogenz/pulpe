import { describe, expect, it } from 'vitest';

import type { FeedbackPromptState } from '@core/storage/storage-schemas';
import { isFeedbackPromptDue } from './feedback-prompt';

const state = (
  overrides: Partial<FeedbackPromptState>,
): FeedbackPromptState => ({
  activeDayCount: 0,
  lastActiveDay: null,
  lastPromptedAtActiveDayCount: null,
  promptCount: 0,
  hasSubmitted: false,
  ...overrides,
});

describe('isFeedbackPromptDue', () => {
  it('should first invite on the third active day, not the second', () => {
    expect(isFeedbackPromptDue(state({ activeDayCount: 2 }))).toBe(false);
    expect(isFeedbackPromptDue(state({ activeDayCount: 3 }))).toBe(true);
  });

  it('should wait until day 6 after a dismissal at day 3', () => {
    const dismissed = { lastPromptedAtActiveDayCount: 3, promptCount: 1 };
    expect(
      isFeedbackPromptDue(state({ ...dismissed, activeDayCount: 5 })),
    ).toBe(false);
    expect(
      isFeedbackPromptDue(state({ ...dismissed, activeDayCount: 6 })),
    ).toBe(true);
  });

  it('should never invite again once submitted', () => {
    expect(
      isFeedbackPromptDue(state({ activeDayCount: 9, hasSubmitted: true })),
    ).toBe(false);
  });
});
