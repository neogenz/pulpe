import type { BalanceTrajectory } from "pulpe-shared";

import type { TrendedTrajectory } from "./current-month-view-model";

type Point = BalanceTrajectory["real"][number];

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
/** Mirror of `DesignTokens.Chart.gapLabelMinimumRatio` on iOS. */
const GAP_LABEL_MINIMUM_RATIO = 0.08;

/** The plan's straight fall, opening amount to planned remaining. */
export function chartPlan(trajectory: TrendedTrajectory): Point[] {
  return [
    { day: 0, balance: trajectory.plannedAvailable },
    { day: trajectory.totalDays, balance: trajectory.plannedBalance },
  ];
}

/**
 * The days not yet lived, from what is left today to the trend's landing. Empty
 * on the last day, where there is nothing left to project.
 */
export function chartProjection(trajectory: TrendedTrajectory): Point[] {
  const current = trajectory.real[trajectory.real.length - 1];
  if (trajectory.today >= trajectory.totalDays || current === undefined)
    return [];
  return [current, { day: trajectory.totalDays, balance: trajectory.trend }];
}

/**
 * How much vertical room the drawing claims. The floor is spent as slack around
 * the readings rather than added below them, so a quiet month is not pinned to
 * the top of its frame. Three quarters of it go under the line: empty sky above
 * a flat line reads as a missing plot. Port of `chartYDomain` in
 * `HomeHeroCard+Chart.swift`.
 */
export function chartYDomain(trajectory: TrendedTrajectory): [number, number] {
  const values = plotted(trajectory);
  const lower = Math.min(...values);
  const upper = Math.max(...values);
  const span = chartSpan(trajectory);
  const slack = Math.max(span - (upper - lower), 0);
  const padding = Math.max(span * DOMAIN_PADDING_RATIO, MINIMUM_DOMAIN_PADDING);

  return [lower - slack * 0.75 - padding, upper + slack * 0.25 + padding];
}

export function chartSpan(trajectory: TrendedTrajectory): number {
  const values = plotted(trajectory);
  const amplitude = Math.max(...values) - Math.min(...values);
  return Math.max(
    amplitude,
    trajectory.plannedOutflows * LANDING_SCALE_FLOOR_RATIO,
  );
}

/**
 * The trend is spoken only once it is visibly apart from the plan's end; closer
 * than that the two strokes land on one point.
 */
export function showsTrendLabel(trajectory: TrendedTrajectory): boolean {
  if (chartProjection(trajectory).length === 0) return false;
  const gap = Math.abs(trajectory.trend - trajectory.plannedBalance);
  return gap > 0 && gap >= chartSpan(trajectory) * GAP_LABEL_MINIMUM_RATIO;
}

/** Every value the plot draws: both plan ends, the real stroke, the trend. */
function plotted(trajectory: TrendedTrajectory): number[] {
  return [
    ...[...chartPlan(trajectory), ...trajectory.real].map(
      (point) => point.balance,
    ),
    trajectory.trend,
  ];
}
