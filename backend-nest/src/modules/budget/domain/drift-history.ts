import {
  BudgetFormulas,
  getBudgetPeriodDates,
  isOutflowKind,
  type TransactionKind,
} from 'pulpe-shared';

/**
 * How a user's closed months usually drifted from their plan. Consumed by the
 * iOS home projection as a Bühlmann credibility prior: `usualOutflowDrift`
 * is the prior mean, `priorStrength` its weight in days, `driftMad` the cap.
 * `driftProfile` (share of the drift reached at 25/50/75/100 % of the period)
 * is computed but not consumed yet (phase 4 of the plan).
 */
export interface DriftHistory {
  usualOutflowDrift: number;
  closedMonths: number;
  priorStrength: number;
  driftMad: number;
  driftProfile: number[];
}

export interface HistoryLine {
  id: string;
  kind: TransactionKind;
  amount: number;
  checkedAt: string | null;
}

export interface HistoryTransaction {
  kind: TransactionKind;
  amount: number;
  budgetLineId: string | null;
  /** ISO date or datetime; only its `YYYY-MM-DD` prefix is read. */
  transactionDate: string;
}

export interface HistoryMonth {
  month: number;
  year: number;
  budgetLines: HistoryLine[];
  transactions: HistoryTransaction[];
}

export const PRIOR_STRENGTH_MIN = 3;
export const PRIOR_STRENGTH_MAX = 14;
const PROFILE_SHARES = [0.25, 0.5, 0.75, 1];

/** Closed = pay-day period ended before `now` AND every prévision pointed. */
export function isClosedMonth(
  month: {
    month: number;
    year: number;
    budgetLines: { checkedAt: string | null }[];
  },
  payDayOfMonth: number,
  now: Date,
): boolean {
  const { endDate } = getBudgetPeriodDates(
    month.month,
    month.year,
    payDayOfMonth,
  );
  return (
    endDate < now && month.budgetLines.every((line) => line.checkedAt !== null)
  );
}

export interface MonthDrift {
  /** Drift at the end of each day, index 0 = opening (always 0). */
  daily: number[];
  endDrift: number;
  plannedOutflows: number;
  /** `drift / plannedOutflows`; `null` when the month had no planned outflow. */
  rate: number | null;
  /** Share of `endDrift` reached at 25/50/75/100 %; `null` when `endDrift` is 0. */
  profile: number[] | null;
}

/**
 * Drift = where the period lands knowing the transactions dated ≤ t, minus where
 * the plan alone landed. Same envelope arithmetic as the iOS landing line
 * (`BudgetFormulas.calculateAllMetrics`), so the profile measures what the chart draws.
 */
export function monthDrift(
  month: HistoryMonth,
  payDayOfMonth: number,
): MonthDrift {
  const { startDate, endDate } = getBudgetPeriodDates(
    month.month,
    month.year,
    payDayOfMonth,
  );
  const totalDays = Math.max(daysBetween(startDate, endDate) + 1, 1);
  const planned = BudgetFormulas.calculateAllMetrics(
    month.budgetLines,
  ).remaining;
  const landing = (transactions: HistoryTransaction[]) =>
    BudgetFormulas.calculateAllMetrics(month.budgetLines, transactions)
      .remaining - planned;

  const daily: number[] = [0];
  for (let day = 1; day < totalDays; day++) {
    const cutoff = isoDate(addDays(startDate, day - 1));
    daily.push(
      landing(
        month.transactions.filter(
          (t) => t.transactionDate.slice(0, 10) <= cutoff,
        ),
      ),
    );
  }
  // The final reading takes every transaction, dated outside the period or not:
  // that is the real landing, the number the next months are compared to.
  const endDrift = landing(month.transactions);
  daily.push(endDrift);

  const plannedOutflows = month.budgetLines
    .filter((line) => isOutflowKind(line.kind))
    .reduce((sum, line) => sum + line.amount, 0);

  return {
    daily,
    endDrift,
    plannedOutflows,
    rate: plannedOutflows > 0 ? endDrift / plannedOutflows : null,
    profile:
      endDrift === 0
        ? null
        : PROFILE_SHARES.map((share) =>
            clamp(daily[Math.round(totalDays * share)] / endDrift, 0, 1),
          ),
  };
}

/**
 * Aggregates the ≤12 most recent closed months (newest first in `months`).
 * Returns `null` when there is no closed month.
 */
export function driftHistory(
  months: HistoryMonth[],
  payDayOfMonth: number,
  now: Date = new Date(),
): DriftHistory | null {
  const closed = months
    .filter((m) => isClosedMonth(m, payDayOfMonth, now))
    .slice(0, 12)
    .map((m) => monthDrift(m, payDayOfMonth));
  if (closed.length === 0) return null;

  const endDrifts = closed.map((m) => m.endDrift);
  const rates = closed
    .map((m) => m.rate)
    .filter((r): r is number => r !== null);
  const signConsistency =
    Math.abs(endDrifts.reduce((sum, d) => sum + Math.sign(d), 0)) /
    closed.length;
  const usualOutflowDrift =
    rates.length > 0 && signConsistency >= 0.5 ? median(rates) : 0;

  const driftMedian = median(endDrifts);
  const driftMad = median(endDrifts.map((d) => Math.abs(d - driftMedian)));

  const profiles = closed
    .map((m) => m.profile)
    .filter((p): p is number[] => p !== null);
  const driftProfile = PROFILE_SHARES.map((_, i) =>
    profiles.length > 0 ? median(profiles.map((p) => p[i])) : PROFILE_SHARES[i],
  );
  for (let i = 1; i < driftProfile.length; i++) {
    driftProfile[i] = Math.max(driftProfile[i], driftProfile[i - 1]);
  }
  driftProfile[driftProfile.length - 1] = 1;

  return {
    usualOutflowDrift: round4(usualOutflowDrift),
    closedMonths: closed.length,
    priorStrength: priorStrength(closed),
    driftMad: round2(driftMad),
    driftProfile: driftProfile.map(round4),
  };
}

/**
 * Efron-Morris moment estimate of K = σ²_within / σ²_between, in days.
 * σ²_within: pooled variance of the daily drift increments over the closed months.
 * σ²_between: Var(endDrift / T) minus the share sampling noise explains, floored
 * at a tenth of it so one regular user never divides by zero.
 */
function priorStrength(closed: MonthDrift[]): number {
  let sumSq = 0;
  let dof = 0;
  for (const m of closed) {
    const increments = m.daily.slice(1).map((d, i) => d - m.daily[i]);
    const mean = increments.reduce((s, x) => s + x, 0) / increments.length;
    sumSq += increments.reduce((s, x) => s + (x - mean) ** 2, 0);
    dof += Math.max(increments.length - 1, 0);
  }
  const within = dof > 0 ? sumSq / dof : 0;
  if (within === 0) return PRIOR_STRENGTH_MIN;

  const meanDays =
    closed.reduce((s, m) => s + m.daily.length - 1, 0) / closed.length;
  const noise = within / meanDays;
  const between = Math.max(
    variance(closed.map((m) => m.endDrift / (m.daily.length - 1))) - noise,
    0.1 * noise,
  );
  return Math.round(
    clamp(within / between, PRIOR_STRENGTH_MIN, PRIOR_STRENGTH_MAX),
  );
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  return values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(Math.max(x, lo), hi);
const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
