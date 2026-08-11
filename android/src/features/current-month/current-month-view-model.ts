import {
  type Budget,
  type BudgetLine,
  type BudgetPeriod,
  type BudgetSparse,
  BudgetFormulas,
  type EmotionState,
  getBudgetPeriodDates,
  type Transaction,
  type TransactionKind,
} from "pulpe-shared";

import type { BudgetDetails } from "@/features/budgets/budget-api";

/** Mirrors `BudgetLine.rolloverLine` in `ios/Pulpe/Domain/Models/BudgetLine.swift`. */
const ROLLOVER_LINE_NAME = "Report du mois précédent";
const ROLLOVER_LINE_ID_PREFIX = "rollover-";

/** Same ceiling as the iOS dashboard card: a longer list stops being a to-do. */
const MAX_UNCHECKED_ITEMS = 5;

const MILLISECONDS_PER_DAY = 86_400_000;
const PERCENT = 100;

/** Order the "à pointer" card lists budget lines in, after the transactions. */
const KIND_ORDER: TransactionKind[] = ["income", "expense", "saving"];

export interface LineConsumption {
  allocated: number;
  available: number;
  percentage: number;
}

export interface DriftLine {
  line: BudgetLine;
  consumption: LineConsumption;
}

export interface CheckableItem {
  id: string;
  name: string;
  kind: TransactionKind;
  amount: number;
  /** Present when the item is, or belongs to, an envelope with a plan. */
  consumption: LineConsumption | null;
}

export interface SavingsSummary {
  totalPlanned: number;
  totalRealized: number;
  checkedCount: number;
  totalCount: number;
  progressPercentage: number;
  isComplete: boolean;
  hasSavings: boolean;
}

export interface PeriodProgress {
  day: number;
  totalDays: number;
}

export interface CurrentMonthViewModel {
  metrics: ReturnType<typeof BudgetFormulas.calculateAllMetrics>;
  emotion: EmotionState;
  daysRemaining: number;
  dailyBudget: number;
  driftLines: DriftLine[];
  driftTotal: number;
  uncheckedCount: number;
  uncheckedItems: CheckableItem[];
  savings: SavingsSummary;
  periodProgress: PeriodProgress;
}

export interface CurrentMonthContext {
  now: Date;
  payDayOfMonth?: number | null;
}

/**
 * The budget list comes back as periods only, so matching is a plain lookup —
 * an absent match means the month has no budget yet, not that something failed.
 */
export function selectBudgetIdForPeriod(
  budgets: BudgetSparse[],
  period: BudgetPeriod,
): string | null {
  const match = budgets.find(
    (budget) => budget.month === period.month && budget.year === period.year,
  );
  return match?.id ?? null;
}

/**
 * Prepends the virtual line that shows last month's carry-over, so it reads as
 * an envelope in the lists. Port of `BudgetFormulas.displayBudgetLines`; the
 * aggregates take the rollover as a scalar instead and must not be given this
 * list, or they would count it twice.
 */
export function withRolloverLine(
  budget: Budget,
  budgetLines: BudgetLine[],
): BudgetLine[] {
  const rollover = budget.rollover ?? 0;
  if (rollover === 0) return budgetLines;

  const timestamp = new Date().toISOString();
  const rolloverLine: BudgetLine = {
    id: `${ROLLOVER_LINE_ID_PREFIX}${budget.id}`,
    budgetId: budget.id,
    templateLineId: null,
    savingsGoalId: null,
    name: ROLLOVER_LINE_NAME,
    amount: Math.abs(rollover),
    kind: rollover >= 0 ? "income" : "expense",
    recurrence: "one_off",
    isManuallyAdjusted: false,
    checkedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    isRollover: true,
    rolloverSourceBudgetId: budget.previousBudgetId ?? undefined,
  };

  return [rolloverLine, ...budgetLines];
}

/**
 * What an envelope has absorbed so far. Port of
 * `BudgetFormulas.calculateConsumption` (Swift) — it drives a progress bar and
 * the drift filter, never a stored amount, which is why it lives here rather
 * than in `shared/src/calculators/`.
 */
export function lineConsumption(
  line: BudgetLine,
  transactions: Transaction[],
): LineConsumption {
  const allocated = transactions
    .filter((transaction) => transaction.budgetLineId === line.id)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    allocated,
    available: line.amount - allocated,
    percentage: line.amount > 0 ? (allocated / line.amount) * PERCENT : 0,
  };
}

export function buildCurrentMonthViewModel(
  { budget, budgetLines, transactions }: BudgetDetails,
  { now, payDayOfMonth }: CurrentMonthContext,
): CurrentMonthViewModel {
  const metrics = BudgetFormulas.calculateAllMetrics(
    budgetLines,
    transactions,
    budget.rollover ?? 0,
  );
  const driftLines = selectDriftLines(budgetLines, transactions);
  const daysRemaining = countDaysRemaining(budget, now, payDayOfMonth);

  return {
    metrics,
    emotion: BudgetFormulas.emotionState(metrics),
    daysRemaining,
    dailyBudget: metrics.remaining > 0 ? metrics.remaining / daysRemaining : 0,
    driftLines,
    driftTotal: driftLines.reduce(
      (total, drift) => total - drift.consumption.available,
      0,
    ),
    uncheckedCount: countUnchecked(budgetLines, transactions),
    uncheckedItems: selectUncheckedItems(budgetLines, transactions),
    savings: summarizeSavings(budgetLines, transactions),
    periodProgress: measurePeriodProgress(budget, now, payDayOfMonth),
  };
}

/**
 * Envelopes consumed past their plan, worst first. The test is `available < 0`
 * rather than `percentage > 100` so a zero-amount envelope with spending on it
 * counts too — dividing by its plan would report 0 %.
 */
function selectDriftLines(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
): DriftLine[] {
  return budgetLines
    .filter((line) => line.kind === "expense" && line.isRollover !== true)
    .map((line) => ({ line, consumption: lineConsumption(line, transactions) }))
    .filter((drift) => drift.consumption.available < 0)
    .sort((a, b) => a.consumption.available - b.consumption.available);
}

/**
 * Uncapped, unlike `selectUncheckedItems` — the header states how much is left
 * to do, and a count that stopped at five would understate it. A count and not
 * a sum: mixing an expected salary with an expected rent under one total reads
 * as a number the user could act on, and it is not one.
 */
function countUnchecked(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
): number {
  const uncheckedTransactions = transactions.filter(isUnchecked).length;
  const uncheckedLines = budgetLines.filter(
    (line) => isUnchecked(line) && line.isRollover !== true,
  ).length;
  return uncheckedTransactions + uncheckedLines;
}

/**
 * Free transactions first, then allocated ones, then the forecasts — what the
 * user actually spent outranks what they planned to.
 */
function selectUncheckedItems(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
): CheckableItem[] {
  const unchecked = transactions.filter(isUnchecked);
  const linesById = new Map(budgetLines.map((line) => [line.id, line]));

  const freeTransactions = unchecked
    .filter((transaction) => transaction.budgetLineId === null)
    .sort(byTransactionDateDesc)
    .map((transaction) => toCheckableItem(transaction, null));

  const allocatedTransactions = unchecked
    .filter((transaction) => transaction.budgetLineId !== null)
    .sort(byTransactionDateDesc)
    .map((transaction) => {
      const line = linesById.get(transaction.budgetLineId as string);
      return toCheckableItem(
        transaction,
        line ? lineConsumption(line, transactions) : null,
      );
    });

  const uncheckedLines = budgetLines
    .filter((line) => isUnchecked(line) && line.isRollover !== true)
    .sort(byKindThenNewest)
    .map((line) => ({
      id: `bl-${line.id}`,
      name: line.name,
      kind: line.kind,
      amount: line.amount,
      consumption: lineConsumption(line, transactions),
    }));

  return [
    ...freeTransactions,
    ...allocatedTransactions,
    ...uncheckedLines,
  ].slice(0, MAX_UNCHECKED_ITEMS);
}

function summarizeSavings(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
): SavingsSummary {
  const savingLines = budgetLines.filter(
    (line) => line.kind === "saving" && line.isRollover !== true,
  );
  const totalPlanned = savingLines.reduce((sum, line) => sum + line.amount, 0);
  const totalRealized = BudgetFormulas.calculateRealizedSavings(
    budgetLines,
    transactions,
  );
  const progressPercentage =
    totalPlanned > 0
      ? Math.max(0, Math.min((totalRealized / totalPlanned) * PERCENT, PERCENT))
      : 0;

  return {
    totalPlanned,
    totalRealized,
    checkedCount: savingLines.filter((line) => !isUnchecked(line)).length,
    totalCount: savingLines.length,
    progressPercentage,
    isComplete: totalPlanned > 0 && progressPercentage >= PERCENT,
    hasSavings: totalPlanned > 0 || totalRealized > 0,
  };
}

/** Today included, so the last day of the period still reads as one day left. */
function countDaysRemaining(
  budget: Budget,
  now: Date,
  payDayOfMonth?: number | null,
): number {
  const { endDate } = getBudgetPeriodDates(
    budget.month,
    budget.year,
    payDayOfMonth,
  );
  return Math.max(countDaysBetween(now, endDate) + 1, 1);
}

function measurePeriodProgress(
  budget: Budget,
  now: Date,
  payDayOfMonth?: number | null,
): PeriodProgress {
  const { startDate, endDate } = getBudgetPeriodDates(
    budget.month,
    budget.year,
    payDayOfMonth,
  );
  const totalDays = Math.max(countDaysBetween(startDate, endDate) + 1, 1);
  const day = countDaysBetween(startDate, now) + 1;

  return { day: Math.min(Math.max(day, 1), totalDays), totalDays };
}

/**
 * Rounded rather than truncated: a period that crosses a daylight-saving change
 * spans 23 or 25 hours on one of its days, and flooring would lose it.
 */
function countDaysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) /
      MILLISECONDS_PER_DAY,
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isUnchecked(item: { checkedAt: string | null }): boolean {
  return item.checkedAt === null;
}

function toCheckableItem(
  transaction: Transaction,
  consumption: LineConsumption | null,
): CheckableItem {
  return {
    id: `tx-${transaction.id}`,
    name: transaction.name,
    kind: transaction.kind,
    amount: transaction.amount,
    consumption,
  };
}

function byTransactionDateDesc(a: Transaction, b: Transaction): number {
  return b.transactionDate.localeCompare(a.transactionDate);
}

function byKindThenNewest(a: BudgetLine, b: BudgetLine): number {
  const kindDelta = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  return kindDelta !== 0 ? kindDelta : b.createdAt.localeCompare(a.createdAt);
}
