import type { SavingsGoalPlanMonth, SavingsGoalProgress } from "pulpe-shared";

const DOMAIN_PADDING_RATIO = 0.08;
const MINIMUM_DOMAIN_PADDING = 1;
/** Below this the first tick would collide with the "this month" one. */
const MINIMUM_TICK_SEPARATION = 3;
/** A line needs two points; a lone dot is decoration, not a trajectory. */
const MINIMUM_LINE_POINTS = 2;

/**
 * A type rather than an interface, against the house rule: victory-native takes
 * `Record<string, unknown>[]`, and only a type alias is assignable to that.
 */
export type ProjectionPoint = {
  index: number;
  /** Reality — null past the current month, so the solid line stops there. */
  confirmed: number | null;
  /** The plan from the current month on; they share the joint. */
  projection: number | null;
};

export interface ProjectionTick {
  index: number;
  month: number;
  year: number;
}

export interface ProjectionSeries {
  points: ProjectionPoint[];
  target: number | null;
  ticks: ProjectionTick[];
  /**
   * Gates "Ta trajectoire", as on iOS and the webapp: a plan fed by at least
   * one linked prévision, and two points to draw, confirmed or projected. On
   * day one the planned curve alone already shows the road to the target.
   */
  hasDrawableLine: boolean;
}

/**
 * "Ta trajectoire": the confirmed balance up to now, then where the plan lands
 * it, against the flat target rule.
 *
 * The last point of each line is overwritten with the server's own figure —
 * `progress.confirmed` and `progress.projected` are canonical, and letting the
 * client's running sum end somewhere else would make the chart disagree with
 * the card above it over rounding.
 */
export function projectionSeries(
  progress: SavingsGoalProgress,
): ProjectionSeries {
  const months = progress.months;
  if (months.length === 0) {
    return { points: [], target: null, ticks: [], hasDrawableLine: false };
  }

  const currentIndex = currentMonthIndex(months);
  const lastIndex = months.length - 1;
  const confirmed = confirmedValues(months, currentIndex, progress.confirmed);
  const projection = projectionValues(
    months,
    currentIndex,
    lastIndex,
    progress.confirmed,
    progress.projected ?? progress.plannedProjection,
  );

  return {
    points: months.map((_, index) => ({
      index,
      confirmed: confirmed.get(index) ?? null,
      projection: projection.get(index) ?? null,
    })),
    target: progress.targetAmount,
    ticks: ticksFor(months, currentIndex),
    hasDrawableLine:
      progress.linkedLineCount > 0 &&
      (confirmed.size >= MINIMUM_LINE_POINTS ||
        projection.size >= MINIMUM_LINE_POINTS),
  };
}

/** Zero-based, and never negative: the plot always starts at the floor. */
export function projectionYDomain(series: ProjectionSeries): [number, number] {
  const values = series.points.flatMap((point) =>
    [point.confirmed, point.projection].filter(
      (value): value is number => value !== null,
    ),
  );
  const highest = Math.max(...values, series.target ?? 0, 0);
  const padding = Math.max(
    highest * DOMAIN_PADDING_RATIO,
    MINIMUM_DOMAIN_PADDING,
  );

  return [0, highest + padding];
}

function currentMonthIndex(months: SavingsGoalPlanMonth[]): number {
  const index = months.findIndex((month) => month.state === "current");
  return index === -1 ? months.length - 1 : index;
}

function confirmedValues(
  months: SavingsGoalPlanMonth[],
  currentIndex: number,
  confirmedTotal: number,
): Map<number, number> {
  const values = new Map<number, number>();
  for (let index = 0; index <= currentIndex; index += 1) {
    values.set(index, months[index].confirmedCumulative);
  }
  values.set(currentIndex, confirmedTotal);
  return values;
}

function projectionValues(
  months: SavingsGoalPlanMonth[],
  currentIndex: number,
  lastIndex: number,
  confirmedTotal: number,
  projectedTotal: number,
): Map<number, number> {
  const values = new Map<number, number>();
  if (currentIndex === lastIndex) {
    values.set(currentIndex, projectedTotal);
    return values;
  }

  values.set(currentIndex, confirmedTotal);
  let cumulative = confirmedTotal;
  for (let index = currentIndex; index <= lastIndex; index += 1) {
    // Only what a month still owes: the part already confirmed is in the
    // balance the projection starts from.
    cumulative += Math.max(
      0,
      months[index].plannedAmount - months[index].confirmedAmount,
    );
    if (index > currentIndex) values.set(index, cumulative);
  }
  values.set(lastIndex, projectedTotal);
  return values;
}

/** Three labels at most: where the plan started, where it is, where it ends. */
function ticksFor(
  months: SavingsGoalPlanMonth[],
  currentIndex: number,
): ProjectionTick[] {
  const lastIndex = months.length - 1;
  const indices = new Set([currentIndex, lastIndex]);
  if (currentIndex >= MINIMUM_TICK_SEPARATION) indices.add(0);

  return [...indices]
    .sort((left, right) => left - right)
    .map((index) => ({
      index,
      month: months[index].month,
      year: months[index].year,
    }));
}
