import {
  availableAfterNote,
  type BudgetLine,
  comparedFigure,
  type ComparisonScreen,
  comparisonScreen,
  CURRENCY_METADATA,
  gapClosedByChecks,
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
  isSalaryMaybeEarly,
  type MatchedBreakdown,
  matchedBreakdown,
  moneyDifference,
  periodFromIndex,
  periodIndex,
  rankedPointingCandidates,
  type ReconciliationContext,
  type ReconciliationVerdict,
  type SupportedCurrency,
  type Transaction,
  type TransactionCreate,
  type TransactionKind,
} from "pulpe-shared";

import { countDaysBetween, isPointableLine } from "./current-month-view-model";

/** Never a saving: the gap came in or went out, it was not set aside. */
export type ReconciliationAdjustment = Exclude<
  ReconciliationVerdict,
  { kind: "upToDate" }
>;

/**
 * One checked, free entry on the budget the reconciliation was opened on.
 * Stamped now on both sides: the adjustment is a fact of today, already seen.
 */
export function buildAdjustmentPayload(input: {
  budgetId: string;
  name: string;
  adjustment: ReconciliationAdjustment;
  now: Date;
}): TransactionCreate {
  const stamp = input.now.toISOString();
  return {
    budgetId: input.budgetId,
    name: input.name.trim(),
    amount: input.adjustment.amount,
    kind: input.adjustment.kind,
    transactionDate: stamp,
    checkedAt: stamp,
  };
}

/**
 * The sample figures are the story, not the user's data: « Masquer les
 * montants » leaves them be, so they skip the masking formatter and keep its
 * digits and separators (`890.00` in CHF, `890,00` in EUR).
 */
export function plain(value: number, currency: SupportedCurrency): string {
  return new Intl.NumberFormat(CURRENCY_METADATA[currency].numberLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** An unchecked item of this month whose check moves the compared figure. */
export interface SuggestionRow {
  source: "transaction" | "budgetLine";
  id: string;
  name: string;
  amount: number;
  /** Its money kind, whatever the source: a saving asks for its own words (spec §4.2). */
  kind: TransactionKind;
  /** The movement's date, for a movement. */
  date: string | null;
  /** Checking it alone leaves no gap, and its amount is the gap itself (spec §4.2). */
  settles: boolean;
}

export interface Comparison {
  onAccounts: number;
  compared: number;
  /** The figure before the first check of this comparison, once a check moved it. */
  comparedBefore: number | null;
  /** The month's realized balance, the Accueil's « Solde pointé », shown as Pulpe's figure. */
  realized: number;
  /** The realized balance at the first check, once a check of this month moved it: struck through. */
  realizedBefore: number | null;
  /** How much nearer zero the checks brought the gap: one that widens it finds nothing. */
  found: number;
  gap: number;
  screen: ComparisonScreen;
  suggestions: SuggestionRow[];
  /** Left on the « À pointer » page beyond the suggestions. */
  othersCount: number;
  note: { before: number; after: number };
  matched: MatchedBreakdown;
  /** Money from before Pulpe, part of `compared`; shown apart when not 0. */
  startingAmount: number;
  /** The day of the month the next period starts: « Reviens comparer le 25 ». */
  nextPayDay: number;
}

/** Step 2's numbers and screen, from the shared rules (spec.md §4). `ReconcileCompareStep` on the web. */
export function buildComparison(input: {
  onAccountsCents: number;
  realizedBalance: number;
  /** « Disponible à dépenser » of the month. */
  available: number;
  budgetLines: BudgetLine[];
  transactions: Transaction[];
  context: ReconciliationContext;
  comparedBefore: number | null;
  realizedBefore: number | null;
  isDismissed: boolean;
  payDayOfMonth: number | null;
  today: Date;
}): Comparison {
  const { budgetLines, transactions, context } = input;
  const onAccounts = input.onAccountsCents / 100;
  const compared = comparedFigure(
    input.realizedBalance,
    context.startingAmount,
  );
  const gap = moneyDifference(onAccounts, compared);
  const comparedBefore =
    input.comparedBefore === compared ? null : input.comparedBefore;
  const suggestions = rankedPointingCandidates(
    gap,
    budgetLines,
    transactions,
  ).flatMap(({ source, id, remainingGap }): SuggestionRow[] => {
    const item =
      source === "budgetLine"
        ? budgetLines.find((line) => line.id === id)
        : transactions.find((transaction) => transaction.id === id);
    if (item === undefined) return [];
    return [
      {
        source,
        id,
        name: item.name,
        amount: item.amount,
        kind: item.kind,
        date: "transactionDate" in item ? item.transactionDate : null,
        // A 120 movement under a checked 100 prévision closes a 20 gap: ranked first, never highlighted.
        settles:
          remainingGap === 0 &&
          moneyDifference(item.amount, Math.abs(gap)) === 0,
      },
    ];
  });
  // What the « À pointer » page lists: unchecked movements and prévisions, savings withdrawals aside.
  const toCheckCount =
    transactions.filter((transaction) => transaction.checkedAt === null)
      .length +
    budgetLines.filter(
      (line) => line.checkedAt === null && isPointableLine(line),
    ).length;

  // The next period's own start, not the day after this one's end: with a pay
  // day of 31, February ends on the 28th in one helper and March starts on it.
  const { payDayOfMonth, today } = input;
  const current = getBudgetPeriodForDate(today, payDayOfMonth);
  const startOf = (offset: number) => {
    const { month, year } = periodFromIndex(periodIndex(current) + offset);
    return getBudgetPeriodDates(month, year, payDayOfMonth).startDate;
  };
  // On pay day itself the next period starts today: wait for the one after.
  const following = startOf(1);
  const nextStart =
    countDaysBetween(today, following) > 0 ? following : startOf(2);

  return {
    onAccounts,
    compared,
    comparedBefore,
    realized: input.realizedBalance,
    // Checked then unchecked back to the start: nothing struck through.
    realizedBefore:
      input.realizedBefore === null ||
      moneyDifference(input.realizedBefore, input.realizedBalance) === 0
        ? null
        : input.realizedBefore,
    found:
      comparedBefore === null
        ? 0
        : gapClosedByChecks({ onAccounts, comparedBefore, compared }),
    gap,
    screen: comparisonScreen({
      gap,
      candidateCount: suggestions.length,
      dismissed: input.isDismissed,
      first: !context.hasCompletedComparison && context.startingAmount === 0,
      salaryMaybeEarly: isSalaryMaybeEarly({
        gap,
        payDayOfMonth,
        // Today counted: the 23rd with the next period on the 25th leaves 2 days.
        daysUntilNextPeriod: countDaysBetween(today, nextStart),
      }),
    }),
    suggestions,
    othersCount: toCheckCount - suggestions.length,
    note: availableAfterNote(input.available, gap),
    matched: matchedBreakdown({
      available: input.available,
      compared,
      startingAmount: context.startingAmount,
    }),
    startingAmount: context.startingAmount,
    nextPayDay: nextStart.getDate(),
  };
}
