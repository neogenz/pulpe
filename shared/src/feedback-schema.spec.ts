import { describe, expect, it } from 'vitest';
import { feedbackCreateSchema } from '../schemas.js';

const minimalFeedback = {
  overallRating: 4,
  appVersion: '1.4.0',
  iosVersion: '19.0',
};

describe('feedbackCreateSchema', () => {
  it('accepts minimal and complete feedback', () => {
    expect(feedbackCreateSchema.parse(minimalFeedback)).toEqual(
      minimalFeedback,
    );

    expect(
      feedbackCreateSchema.parse({
        ...minimalFeedback,
        onboarding: 1,
        budgetClarity: 2,
        currentMonth: 3,
        futurePlanning: 4,
        homeClarity: 5,
        other: 3,
        comment: '  Simple et utile.  ',
      }),
    ).toEqual({
      ...minimalFeedback,
      onboarding: 1,
      budgetClarity: 2,
      currentMonth: 3,
      futurePlanning: 4,
      homeClarity: 5,
      other: 3,
      comment: 'Simple et utile.',
    });
  });

  it.each([
    ['overallRating', 0],
    ['overallRating', 6],
    ['overallRating', 2.5],
    ['onboarding', 0],
    ['budgetClarity', 6],
    ['currentMonth', 1.5],
    ['futurePlanning', -1],
    ['homeClarity', 7],
    ['other', 0],
  ] as const)('rejects invalid %s rating', (field, value) => {
    expect(
      feedbackCreateSchema.safeParse({ ...minimalFeedback, [field]: value })
        .success,
    ).toBe(false);
  });

  it('normalizes a blank comment to absence', () => {
    expect(
      feedbackCreateSchema.parse({ ...minimalFeedback, comment: '   ' }),
    ).toEqual(minimalFeedback);
  });

  it('measures the comment limit in Unicode code points', () => {
    const emojiAtLimit = '😀'.repeat(1_000);
    const combinedAtLimit = 'e\u0301'.repeat(500);

    expect(
      feedbackCreateSchema.safeParse({
        ...minimalFeedback,
        comment: emojiAtLimit,
      }).success,
    ).toBe(true);
    expect(
      feedbackCreateSchema.safeParse({
        ...minimalFeedback,
        comment: combinedAtLimit,
      }).success,
    ).toBe(true);
    expect(
      feedbackCreateSchema.safeParse({
        ...minimalFeedback,
        comment: `${emojiAtLimit}😀`,
      }).success,
    ).toBe(false);
    expect(
      feedbackCreateSchema.safeParse({
        ...minimalFeedback,
        comment: `${combinedAtLimit}a`,
      }).success,
    ).toBe(false);
  });

  it('rejects oversized text and versions', () => {
    expect(
      feedbackCreateSchema.safeParse({
        ...minimalFeedback,
        comment: 'a'.repeat(1_001),
      }).success,
    ).toBe(false);
    expect(
      feedbackCreateSchema.safeParse({
        ...minimalFeedback,
        appVersion: 'a'.repeat(33),
      }).success,
    ).toBe(false);
    expect(
      feedbackCreateSchema.safeParse({ ...minimalFeedback, iosVersion: '' })
        .success,
    ).toBe(false);
  });

  it('rejects unknown properties', () => {
    expect(
      feedbackCreateSchema.safeParse({ ...minimalFeedback, userId: 'forged' })
        .success,
    ).toBe(false);
  });
});
