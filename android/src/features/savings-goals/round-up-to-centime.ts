/**
 * Rounds up to the centime without float drift: `Math.ceil(1.1 * 100)` is 111
 * because `1.1 * 100` is 110.00000000000001. Snapping to four decimals first
 * discards that noise but keeps any real fraction of a centime.
 */
export function roundUpToCentime(amount: number): number {
  return Math.ceil(Math.round(amount * 1e4) / 100) / 100;
}
