import { describe, expect, it } from 'vitest';
import {
  INTRO_SAMPLE,
  introTotals,
  primaryAction,
} from './net-worth-intro.model';

describe('net-worth intro model', () => {
  it('should derive the three figures of the story from the sample lines', () => {
    expect(introTotals(INTRO_SAMPLE)).toEqual({
      gross: 32200,
      netBefore: 26200,
      netAfter: 26700,
    });
  });

  it.each([
    { step: 0, isEmpty: true, expected: 'next' },
    { step: 1, isEmpty: false, expected: 'next' },
    { step: 2, isEmpty: false, expected: 'done' },
    { step: 2, isEmpty: true, expected: 'add' },
  ])(
    'should pick $expected at step $step when empty is $isEmpty',
    ({ step, isEmpty, expected }) => {
      expect(primaryAction(step, isEmpty)).toBe(expected);
    },
  );
});
