import { splitTotalPreserving } from "pulpe-shared";

/** The backend's own ceiling on tranches (`MAX_SPREAD_TRANCHES`). */
export const MAX_SPREAD_MONTHS = 36;
const MONTHS_PER_YEAR = 12;
/** Three months is the shape of the problem: a bill too big for one month. */
export const DEFAULT_SPREAD_LENGTH = 3;

export interface SpreadPeriod {
  year: number;
  month: number;
}

export interface SpreadMonthCell extends SpreadPeriod {
  key: string;
  isSelected: boolean;
}

export type SpreadMode = "total" | "perMonth";

export function periodKey(period: SpreadPeriod): string {
  return `${period.year}-${period.month}`;
}

/** Months since year zero — the only ordering that survives a December. */
function ordinal(period: SpreadPeriod): number {
  return period.year * MONTHS_PER_YEAR + (period.month - 1);
}

function fromOrdinal(value: number): SpreadPeriod {
  return {
    year: Math.floor(value / MONTHS_PER_YEAR),
    month: (value % MONTHS_PER_YEAR) + 1,
  };
}

/**
 * The window the user is looking at: `length` consecutive months from the
 * anchor, each carrying whether it is still in.
 *
 * Deselection is what makes "every month from January to June except March"
 * expressible — the case the whole feature exists for. iOS reaches the same
 * shape with two wheel pickers and a grid; a length plus a tappable grid says
 * it in one gesture fewer, and the grid is what the user reads either way.
 */
export function spreadWindow(
  anchor: SpreadPeriod,
  length: number,
  deselected: readonly string[],
): SpreadMonthCell[] {
  const excluded = new Set(deselected);
  const start = ordinal(anchor);

  return Array.from({ length: Math.max(0, length) }, (_, index) => {
    const period = fromOrdinal(start + index);
    const key = periodKey(period);
    return { ...period, key, isSelected: !excluded.has(key) };
  });
}

export function selectedPeriods(cells: SpreadMonthCell[]): SpreadPeriod[] {
  return cells
    .filter((cell) => cell.isSelected)
    .map(({ year, month }) => ({ year, month }));
}

/**
 * What each selected month will carry, exactly as the server will write it:
 * `total` divides through the shared splitter, `perMonth` replicates. The
 * preview equals the persisted amounts because it is the same function.
 */
export function spreadTranches(
  mode: SpreadMode,
  amount: number,
  monthCount: number,
): number[] {
  if (monthCount < 1 || amount <= 0) return [];
  if (mode === "perMonth")
    return Array.from({ length: monthCount }, () => amount);
  return splitTotalPreserving(amount, monthCount);
}

/** The number the other mode would have shown, so the toggle stays legible. */
export function spreadCounterpart(
  mode: SpreadMode,
  amount: number,
  monthCount: number,
): number {
  const tranches = spreadTranches(mode, amount, monthCount);
  if (tranches.length === 0) return 0;
  return mode === "perMonth"
    ? tranches.reduce((sum, part) => sum + part, 0)
    : tranches[0];
}

/**
 * Why the window cannot be sent, in the order the user would fix it. `null`
 * when it can.
 */
export function spreadWindowProblem(
  cells: SpreadMonthCell[],
  minimumMonths: number,
): string | null {
  const selected = cells.filter((cell) => cell.isSelected).length;
  if (cells.length > MAX_SPREAD_MONTHS)
    return `${MAX_SPREAD_MONTHS} mois maximum`;
  if (selected < minimumMonths) {
    return minimumMonths === 1
      ? "Sélectionne au moins un mois"
      : `Sélectionne au moins ${minimumMonths} mois`;
  }
  return null;
}
