type Translate = (key: string) => string;

/** The encouraging line under a month, resolved from the live catalog. */
export function monthSubtitle(
  t: Translate,
  month: number,
  isPositive: boolean,
): string {
  if (month < 1 || month > 12) return "";
  const tone = isPositive ? "positive" : "negative";
  return t(`budgets.monthSubtitle.${tone}.${month}`);
}
