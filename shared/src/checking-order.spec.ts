import { describe, expect, it } from 'vitest';
import { checkingPriority } from './checking-order.js';

const cases: [number | undefined, number, number][] = [
  [undefined, 10, 32],
  [1, 10, 1],
  [10, 10, 10],
  [15, 10, 47],
  [31, 31, 31],
  [0, 10, 32],
  [32, 10, 32],
];
describe('checkingPriority (iOS parity)', () => {
  it.each(cases)(
    'ranks day %s on period day %i as %i',
    (day, today, expected) => {
      expect(checkingPriority(day, today)).toBe(expected);
    },
  );
});
