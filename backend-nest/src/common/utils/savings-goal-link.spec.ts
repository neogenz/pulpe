import { describe, expect, it } from 'bun:test';
import {
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
