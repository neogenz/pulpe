const CENTS_PER_UNIT = 100;

/** Returns `left - right`, quantized to the nearest cent. */
export function moneyDifference(left: number, right: number): number {
  const cents =
    Math.round(left * CENTS_PER_UNIT) - Math.round(right * CENTS_PER_UNIT);
  return cents === 0 ? 0 : cents / CENTS_PER_UNIT;
}

/**
 * Whether `value` still carries cents once rounded to the cent: `1960.5` does,
 * `1960` and `1960.004` do not. Picks between 0 and 2 decimals for an adaptive
 * amount, which never shows one.
 */
export function hasCents(value: number): boolean {
  return Math.round(Math.abs(value) * CENTS_PER_UNIT) % CENTS_PER_UNIT !== 0;
}
