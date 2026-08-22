/**
 * Reads an amount out of what a numeric keyboard produced. Both separators are
 * accepted because the keyboard offers whichever one the device locale uses,
 * and a half-typed "12," is not yet a number — it reads as 12 until the
 * decimals arrive.
 */
export function parseAmount(input: string): number | null {
  const normalized = input.replace(/[^\d.,]/g, "").replace(",", ".");
  if (normalized.length === 0) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Seeds an amount field's text. Only for the initial value and for an amount
 * changed from outside the field — a field never re-renders its own text from
 * this, or a trailing separator would disappear as the user typed it.
 */
export function seedAmountText(amount: number | null): string {
  return amount === null ? "" : String(amount);
}
