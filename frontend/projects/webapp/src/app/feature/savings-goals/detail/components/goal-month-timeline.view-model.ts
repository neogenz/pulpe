import {
  getBudgetPeriodForDate,
  isContributivePlanMonth,
  type SavingsGoalContribution,
  type SavingsGoalPlanMonth,
  type SavingsGoalPlannedWithdrawal,
  type SavingsGoalPlanOnlyWithdrawal,
  type SavingsGoalWithdrawal,
  type SavingsPlanSimulatedMonth,
  type Transaction,
} from 'pulpe-shared';

export type GoalMonthStatus =
  | 'checked'
  | 'toCheck'
  | 'upcoming'
  | 'repair'
  | 'noForecast'
  | 'gap'
  | 'withdrawnSoFar';

export interface GoalMonthEntry {
  kind: 'month';
  key: string;
  periodKey: number;
  month: number;
  year: number;
  isPast: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  isChecked: boolean;
  status: GoalMonthStatus;
  lineCount: number;
  isOpen: boolean;
  blockedByRealization: boolean;
  /** Budget of the plan-linked withdrawal that locks the month. */
  withdrawalBudgetId: string | null;
  isAdjusted: boolean;
  /** Plan amount (simulated movement while simulating); null = nothing planned. */
  amount: number | null;
  /** Σ of the month's real contributions; null = none yet. */
  realAmount: number | null;
  transactions: Transaction[];
  /** Withdrawal-only month: what left the pot, always positive. */
  withdrawn: number;
  balance: number;
  /** The month carries a withdrawal whose rows are still loading. */
  isBalancePending: boolean;
}

export type GoalWithdrawalSource = 'linked' | 'planOnly' | 'realized';

export interface GoalWithdrawalEntry {
  kind: 'withdrawal';
  key: string;
  source: GoalWithdrawalSource;
  periodKey: number;
  month: number;
  year: number;
  /** Realized withdrawals only — the date of the real income. */
  date: string | null;
  budgetId: string | null;
  name: string;
  status: SavingsGoalPlannedWithdrawal['status'] | null;
  isChecked: boolean;
  /** Positive amounts — the sign is a presentation decision. */
  planned: number | null;
  realized: number | null;
  remaining: number;
  /** null when no plan month carries it: nothing to anchor a balance on. */
  balance: number | null;
  isPast: boolean;
  /** No month row precedes it, so it names its own period. */
  showPeriod: boolean;
}

export interface GoalSkeletonEntry {
  kind: 'skeleton';
  key: string;
  periodKey: number;
  year: number;
}

export type GoalTimelineEntry =
  | GoalMonthEntry
  | GoalWithdrawalEntry
  | GoalSkeletonEntry;

export type GoalVisibleEntry = GoalTimelineEntry & { showYear: boolean };

export interface GoalMonthTimelineInput {
  months: readonly SavingsGoalPlanMonth[];
  /** Non-null while simulating: rows follow the sandbox, withdrawals and réel hidden. */
  simulatedMonths: readonly SavingsPlanSimulatedMonth[] | null;
  contributions: readonly SavingsGoalContribution[];
  plannedWithdrawals: readonly SavingsGoalPlannedWithdrawal[];
  planOnlyWithdrawals: readonly SavingsGoalPlanOnlyWithdrawal[];
  withdrawals: readonly SavingsGoalWithdrawal[];
  isWithdrawalsLoading: boolean;
  canRepair: boolean;
  payDayOfMonth: number | null;
}

export interface GoalMonthTimeline {
  entries: GoalTimelineEntry[];
  /** Month rows, the unit « Voir les N mois » counts. */
  monthCount: number;
  /** Rows showing « Pas de budget », plan-wide (not only the visible window). */
  gapCount: number;
}

export const WINDOW_OPEN_ROWS = 3;

const periodKeyOf = (p: { month: number; year: number }): number =>
  p.year * 12 + p.month;

function monthStatus(
  month: SavingsGoalPlanMonth,
  isChecked: boolean,
  hasTransactions: boolean,
  isRepairable: boolean,
): GoalMonthStatus {
  if (month.isContributionEligible === false) return 'withdrawnSoFar';
  if (month.lines.length === 0) {
    if (isRepairable) return 'repair';
    return month.hasBudget === true ? 'noForecast' : 'gap';
  }
  if (isChecked) return 'checked';
  return month.state === 'future' && !hasTransactions ? 'upcoming' : 'toCheck';
}

/**
 * « Mois par mois » (docs/SAVINGS.md §10.1): ONE chronological list — each plan
 * month, then the withdrawals that hit it. Contributions raise the stock and
 * withdrawals lower it; reading them on one line of time is what explains every
 * jump of the « Solde après » column. A month's balance is quoted BEFORE its
 * withdrawals, each withdrawal row then steps it down, so the last row of the
 * month lands on the server's `projectedCumulative`.
 */
export function buildGoalMonthTimeline(
  input: GoalMonthTimelineInput,
): GoalMonthTimeline {
  const simulated = input.simulatedMonths;
  const source: readonly SavingsGoalPlanMonth[] = simulated ?? input.months;
  const currentKey = source.find((m) => m.state === 'current');
  const currentPeriodKey = currentKey ? periodKeyOf(currentKey) : null;
  const isPastKey = (key: number) =>
    currentPeriodKey !== null && key < currentPeriodKey;

  const transactionsByPeriod = new Map<number, Transaction[]>();
  // Envelope rule (BudgetFormulas): a pointed forecast counts for at least its
  // planned amount, an open one only for what its operations already moved.
  const realByPeriod = new Map<number, number>();
  for (const c of input.contributions) {
    const key = c.budgetYear * 12 + c.budgetMonth;
    transactionsByPeriod.set(key, [
      ...(transactionsByPeriod.get(key) ?? []),
      ...c.transactions,
    ]);
    if (c.checkedAt == null && c.transactions.length === 0) continue;
    const consumed = c.transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const real = c.checkedAt != null ? Math.max(c.amount, consumed) : consumed;
    realByPeriod.set(key, (realByPeriod.get(key) ?? 0) + real);
  }

  // Simulation sandboxes contributions only: withdrawals stay off-screen.
  const withdrawalsByPeriod = new Map<number, GoalWithdrawalEntry[]>();
  if (!simulated) {
    const add = (entry: GoalWithdrawalEntry) =>
      withdrawalsByPeriod.set(entry.periodKey, [
        ...(withdrawalsByPeriod.get(entry.periodKey) ?? []),
        entry,
      ]);
    const base = { balance: null, showPeriod: false, isPast: false };
    for (const w of input.plannedWithdrawals) {
      add({
        ...base,
        kind: 'withdrawal',
        key: `linked-${w.budgetLineId}`,
        source: 'linked',
        periodKey: periodKeyOf(w),
        month: w.month,
        year: w.year,
        date: null,
        budgetId: w.budgetId,
        name: w.name,
        status: w.status,
        isChecked: false,
        planned: w.plannedAmount,
        realized: w.realizedAmount > 0 ? w.realizedAmount : null,
        remaining: w.remainingAmount,
      });
    }
    for (const w of input.planOnlyWithdrawals) {
      add({
        ...base,
        kind: 'withdrawal',
        key: `plan-only-${w.planWithdrawalId}`,
        source: 'planOnly',
        periodKey: periodKeyOf(w),
        month: w.month,
        year: w.year,
        date: null,
        budgetId: null,
        name: w.name,
        status: 'planned',
        isChecked: false,
        planned: w.plannedAmount,
        realized: null,
        remaining: w.plannedAmount,
      });
    }
    // A real income realizing a linked forecast is already the « Réel » of
    // that forecast's row — listing it again would tell the same money twice.
    const linkedLineIds = new Set(
      input.plannedWithdrawals.map((w) => w.budgetLineId),
    );
    const realized = input.withdrawals
      .filter((w) => !w.budgetLineId || !linkedLineIds.has(w.budgetLineId))
      .toSorted((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    for (const w of realized) {
      const period = getBudgetPeriodForDate(
        new Date(w.transactionDate),
        input.payDayOfMonth,
      );
      add({
        ...base,
        kind: 'withdrawal',
        key: `realized-${w.transactionId}`,
        source: 'realized',
        periodKey: periodKeyOf(period),
        month: period.month,
        year: period.year,
        date: w.transactionDate,
        budgetId: w.budgetId,
        name: w.name,
        status: null,
        isChecked: w.checkedAt != null,
        planned: null,
        realized: w.amount,
        remaining: 0,
      });
    }
  }

  const monthsByKey = new Map(source.map((m) => [periodKeyOf(m), m]));
  const keys = [
    ...new Set([...monthsByKey.keys(), ...withdrawalsByPeriod.keys()]),
  ].sort((a, b) => a - b);

  const entries: GoalTimelineEntry[] = [];
  let monthCount = 0;
  let gapCount = 0;
  for (const key of keys) {
    const month = monthsByKey.get(key);
    const withdrawals = withdrawalsByPeriod.get(key) ?? [];
    const projected = month
      ? simulated
        ? (month as SavingsPlanSimulatedMonth).simulatedCumulative
        : (month.projectedCumulative ?? month.plannedCumulative)
      : null;
    // The projection already nets every withdrawal of the period; adding each
    // one back gives the balance before them. A linked withdrawal weighs its
    // full plan (realized part + remainder), not just what is left.
    const effect = (w: GoalWithdrawalEntry) =>
      w.source === 'realized'
        ? (w.realized ?? 0)
        : w.remaining + (w.realized ?? 0);
    let running =
      projected === null
        ? null
        : projected + withdrawals.reduce((sum, w) => sum + effect(w), 0);

    // A month closed to contributions is kept only for its withdrawal, so it
    // stays on screen when nothing else explains the drop — not when the
    // withdrawal rows already do.
    const isWithdrawalOnly = month?.isContributionEligible === false;
    const showMonth =
      !!month &&
      (isWithdrawalOnly
        ? (month.withdrawnAmount ?? 0) > 0 && withdrawals.length === 0
        : true);

    if (month && showMonth) {
      const transactions = simulated
        ? []
        : (transactionsByPeriod.get(key) ?? []);
      const isChecked =
        month.lines.length > 0 &&
        month.lines.every((line) => line.checkedAt != null);
      const blockedByRealization =
        (month.planWithdrawalConsumedAmount ?? 0) > 0 &&
        !isContributivePlanMonth(month);
      // Mirrors the page's repairableMonths() and iOS
      // SavingsGoalPlanMonth.isRepairable: the calculator only sets
      // isProvisionable when the month is empty, open and eligible; canRepair
      // carries the plan-level half (active goal, required amount above zero).
      const isRepairable =
        input.canRepair &&
        month.hasBudget === true &&
        month.isProvisionable === true;
      const status = monthStatus(
        month,
        isChecked,
        transactions.length > 0,
        isRepairable,
      );
      if (status === 'gap') gapCount++;
      const sim = simulated ? (month as SavingsPlanSimulatedMonth) : null;
      const amount = sim
        ? sim.simulatedAmount
        : month.lines.length === 0 && month.plannedAmount === 0
          ? null
          : month.plannedAmount;
      entries.push({
        kind: 'month',
        key: `month-${key}`,
        periodKey: key,
        month: month.month,
        year: month.year,
        isPast: month.state === 'past' || isPastKey(key),
        isCurrent: month.state === 'current',
        isLocked: month.isLocked || blockedByRealization,
        isChecked,
        status,
        lineCount: month.lines.length,
        isOpen: isContributivePlanMonth(month),
        blockedByRealization,
        withdrawalBudgetId:
          input.plannedWithdrawals.find(
            (w) =>
              w.origin === 'plan_linked' &&
              w.month === month.month &&
              w.year === month.year,
          )?.budgetId ?? null,
        isAdjusted: sim?.isAdjusted ?? false,
        amount: isWithdrawalOnly ? null : amount,
        realAmount: simulated ? null : (realByPeriod.get(key) ?? null),
        transactions,
        withdrawn: month.withdrawnAmount ?? 0,
        balance: isWithdrawalOnly ? (projected ?? 0) : (running ?? 0),
        isBalancePending:
          !simulated &&
          input.isWithdrawalsLoading &&
          ((month.withdrawnAmount ?? 0) > 0 ||
            (month.plannedWithdrawalAmount ?? 0) > 0),
      });
      monthCount++;
      if ((entries.at(-1) as GoalMonthEntry).isBalancePending) {
        // Holds the place of the withdrawals still loading under this month.
        entries.push({
          kind: 'skeleton',
          key: `skeleton-${key}`,
          periodKey: key,
          year: month.year,
        });
      }
    }

    for (const w of withdrawals) {
      if (running !== null) running -= effect(w);
      entries.push({
        ...w,
        balance: running,
        isPast: isPastKey(key),
        showPeriod: !showMonth,
      });
    }
  }

  if (!simulated && input.isWithdrawalsLoading && entries.length === 0) {
    entries.push({ kind: 'skeleton', key: 'skeleton', periodKey: 0, year: 0 });
  }

  return { entries, monthCount, gapCount };
}

/**
 * Collapsed: the last locked month and the next WINDOW_OPEN_ROWS months, each
 * with the withdrawals that follow it. Expanded: everything. A year divider
 * opens the window and every year change — a multi-year plan is ambiguous on
 * month names alone.
 */
export function windowGoalTimeline(
  entries: readonly GoalTimelineEntry[],
  expanded: boolean,
): GoalVisibleEntry[] {
  let windowed: readonly GoalTimelineEntry[] = entries;
  const monthIndexes = entries.flatMap((entry, index) =>
    entry.kind === 'month' ? [index] : [],
  );
  if (!expanded && monthIndexes.length > 0) {
    let lastLocked = -1;
    monthIndexes.forEach((entryIndex, i) => {
      if ((entries[entryIndex] as GoalMonthEntry).isLocked) lastLocked = i;
    });
    const startMonth = Math.max(0, lastLocked);
    const endMonth = startMonth + WINDOW_OPEN_ROWS + 1;
    const start = lastLocked < 0 ? 0 : monthIndexes[startMonth];
    const end =
      endMonth >= monthIndexes.length ? entries.length : monthIndexes[endMonth];
    windowed = entries.slice(start, end);
  }
  return windowed.map((entry, index) => ({
    ...entry,
    showYear:
      entry.kind !== 'skeleton' &&
      (index === 0 || entry.year !== windowed[index - 1].year),
  }));
}
