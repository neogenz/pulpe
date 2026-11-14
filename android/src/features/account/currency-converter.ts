/**
 * The converter's "Vers" figure: the typed amount times the day's rate, or
 * null while there is nothing to show. Accepts a decimal comma, as the keypad
 * offers one in French, German and Italian.
 */
export function convertTypedAmount(
  input: string,
  rate: number | undefined,
): number | null {
  if (rate === undefined) return null;
  const typed = input.trim().replace(",", ".");
  if (typed === "") return null;
  const value = Number(typed);
  return Number.isFinite(value) ? value * rate : null;
}
