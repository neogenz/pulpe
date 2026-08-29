import type { BalanceTrajectory } from "pulpe-shared";

export interface CaptionWidths {
  row: number;
  start: number;
  today: number;
  end: number;
}

/**
 * Where the "today" caption starts, in the captions row under the plot. It is
 * centred on the marker's x — the same fraction of the row the canvas uses,
 * since the plot has no padding — and clamped so it never runs into the date
 * at either end. A row too narrow for all three keeps it beside the start.
 */
export function todayCaptionLeft(
  widths: CaptionWidths,
  fraction: number,
  gap: number,
): number {
  const centred = fraction * widths.row - widths.today / 2;
  const min = widths.start + gap;
  const max = widths.row - widths.end - gap - widths.today;
  return Math.max(min, Math.min(centred, max));
}

/**
 * The plotted range never shrinks below this share of what the period planned
 * to spend. Without it, a month held to a couple of hundred francs of its plan
 * fills the frame edge to edge and reads as an accident.
 */
const LANDING_SCALE_FLOOR_RATIO = 0.05;
const DOMAIN_PADDING_RATIO = 0.12;
const MINIMUM_DOMAIN_PADDING = 1;

/**
 * A type rather than an interface, against the house rule: victory-native takes
 * `Record<string, unknown>[]`, and only a type alias is assignable to that.
 */
export type ChartPoint = {
  day: number;
  /** What is known: null past today, so the solid line stops there. */
  landed: number | null;
  /** The forecast held flat over the days not yet lived. */
  projected: number | null;
};

/**
 * One row per day of the period, split into the two lines the chart draws. A
 * single row carries both at the joint, so the dashed line starts exactly where
 * the solid one ends instead of a pixel away from it.
 */
export function chartSeries(trajectory: BalanceTrajectory): ChartPoint[] {
  const landedByDay = new Map(
    trajectory.landing.map((point) => [point.day, point.balance]),
  );
  const lastKnown = trajectory.landing[trajectory.landing.length - 1]?.balance;

  return Array.from({ length: trajectory.totalDays + 1 }, (_, day) => ({
    day,
    landed: landedByDay.get(day) ?? null,
    // Nothing is known about the days not yet lived, so the forecast holds its
    // level across them. A slope here would be the plot inventing news.
    projected:
      day >= trajectory.today && lastKnown !== undefined ? lastKnown : null,
  }));
}

/**
 * How much vertical room the drawing claims. The floor is spent as slack around
 * the readings rather than added below them, so a quiet month sits centred in
 * its frame instead of pinned to the top of it.
 *
 * Unlike the iOS twin, no band is reserved for in-chart labels: the plan and
 * the gap are printed beside the chart here, not inside it.
 */
export function chartYDomain(trajectory: BalanceTrajectory): [number, number] {
  const values = trajectory.landing.map((point) => point.balance);
  const lower = Math.min(...values);
  const upper = Math.max(...values);
  const span = chartSpan(trajectory);
  const slack = Math.max(span - (upper - lower), 0) / 2;
  const padding = Math.max(span * DOMAIN_PADDING_RATIO, MINIMUM_DOMAIN_PADDING);

  return [lower - slack - padding, upper + slack + padding];
}

function chartSpan(trajectory: BalanceTrajectory): number {
  const values = trajectory.landing.map((point) => point.balance);
  const amplitude = Math.max(...values) - Math.min(...values);
  return Math.max(
    amplitude,
    trajectory.plannedOutflows * LANDING_SCALE_FLOOR_RATIO,
  );
}
