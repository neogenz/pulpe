const CENTS_PER_UNIT = 100;

/** Returns `left - right`, quantized to the nearest cent. */
export function moneyDifference(left: number, right: number): number {
  const cents =
    Math.round(left * CENTS_PER_UNIT) - Math.round(right * CENTS_PER_UNIT);
  return cents === 0 ? 0 : cents / CENTS_PER_UNIT;
}
