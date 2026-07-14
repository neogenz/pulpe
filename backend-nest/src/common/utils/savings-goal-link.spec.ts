import { describe, expect, it } from 'bun:test';
import {
  isSavingsGoalLinkDenied,
  savingsGoalIdForKind,
  savingsGoalIdPatchForKind,
} from './savings-goal-link';

const GOAL = '8a0f6c80-1234-4e5f-89ab-333333333333';

describe('savingsGoalIdForKind (create path)', () => {
  it('keeps the link on a saving line', () => {
    expect(savingsGoalIdForKind('saving', GOAL)).toBe(GOAL);
  });

  it('forces null on a non-saving line', () => {
    expect(savingsGoalIdForKind('expense', GOAL)).toBeNull();
    expect(savingsGoalIdForKind('income', GOAL)).toBeNull();
  });

  it('normalizes undefined to null', () => {
    expect(savingsGoalIdForKind('saving', undefined)).toBeNull();
  });
});

describe('savingsGoalIdPatchForKind (update path)', () => {
  it('clears the link when kind moves off saving, even without an explicit id', () => {
    expect(savingsGoalIdPatchForKind('expense', undefined)).toBeNull();
    expect(savingsGoalIdPatchForKind('income', GOAL)).toBeNull();
  });

  it('preserves (undefined) when kind is untouched and no id supplied', () => {
    expect(savingsGoalIdPatchForKind(undefined, undefined)).toBeUndefined();
  });

  it('passes through an explicit id when kind is untouched or saving', () => {
    expect(savingsGoalIdPatchForKind(undefined, GOAL)).toBe(GOAL);
    expect(savingsGoalIdPatchForKind('saving', GOAL)).toBe(GOAL);
  });

  it('passes through an explicit null untag', () => {
    expect(savingsGoalIdPatchForKind('saving', null)).toBeNull();
  });
});

describe('isSavingsGoalLinkDenied (trigger rejection detection)', () => {
  it('matches the exact trigger raise (P0001 + message)', () => {
    expect(
      isSavingsGoalLinkDenied({
        code: 'P0001',
        message: 'Savings goal access denied',
      }),
    ).toBe(true);
  });

  it('ignores other P0001 raises and other codes with the same words', () => {
    expect(
      isSavingsGoalLinkDenied({
        code: 'P0001',
        message: 'Budget access denied',
      }),
    ).toBe(false);
    expect(
      isSavingsGoalLinkDenied({
        code: '23503',
        message: 'Savings goal access denied',
      }),
    ).toBe(false);
    expect(isSavingsGoalLinkDenied(null)).toBe(false);
    expect(isSavingsGoalLinkDenied(undefined)).toBe(false);
  });
});
