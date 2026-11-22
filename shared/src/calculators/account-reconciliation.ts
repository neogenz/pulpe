/**
 * @fileoverview "Rapprocher mes comptes" (PUL-351): the bank balances a user
 * types, held against the checked balance of the loaded month. Runs under the
 * finger — the total and the verdict follow every keystroke — so the web and
 * Android clients import it from here.
 *
 * SWIFT TWIN: `parseAmount`, `totalCents(of:)`, `verdict`,
 * `rankedPointingCandidates` and the screen rules
 * (`comparisonScreen`, `isSalaryMaybeEarly`, `comparedFigure`,
 * `availableAfterNote`, `gapClosedByChecks`, `partlySpentBudgetLines`,
 * `matchedBreakdown`) in
 * `ios/Pulpe/Features/CurrentMonth/Reconciliation/AccountReconciliation.swift`.
 * A change here is a change there, tests and fixtures included, same commit —
 * nothing fails the build when the two diverge (see
 * `.claude/rules/00-architecture/formula-mirrors-ts-swift.md`).
 */

import { moneyDifference } from '../money.js';
import { BudgetFormulas } from './budget-formulas.js';

// A bank balance as typed: an optional minus (an overdraft), at most nine
// digits of units and two of cents. Anything else is refused rather than read
// as zero — a half-typed "12." or a stray letter must stop the user, not quietly
// shift the total they are about to reconcile against.
const ACCOUNT_AMOUNT_PATTERN = /^(-?)(\d{1,9})(?:[.,](\d{1,2}))?$/;
// Pasted from a banking app, an overdraft often carries the typographic minus.
const TYPOGRAPHIC_MINUS = /−/g;
const CENTS_PER_UNIT = 100;

export type AccountAmount =
  | { readonly status: 'blank' }
  | { readonly status: 'invalid' }
  | { readonly status: 'valid'; readonly cents: number };

/**
 * Integer cents, read from the digits themselves rather than through a float,
 * so `0.1` is exactly ten cents and a sum of accounts never drifts.
 */
export function parseAccountAmount(text: string): AccountAmount {
  const normalized = text.trim().replace(TYPOGRAPHIC_MINUS, '-');
  if (normalized === '') return { status: 'blank' };

  const match = ACCOUNT_AMOUNT_PATTERN.exec(normalized);
  if (!match) return { status: 'invalid' };

  const [, sign, units, decimals = ''] = match;
  const magnitude =
    Number(units) * CENTS_PER_UNIT + Number(decimals.padEnd(2, '0'));
  return { status: 'valid', cents: sign === '-' ? -magnitude : magnitude };
}

export interface AccountsSummary {
  /** `null` until every typed amount reads, so no total is ever partial. */
  readonly totalCents: number | null;
  readonly canContinue: boolean;
}

/**
 * Blank rows are skipped — an account added and left empty says nothing — but
 * one unreadable amount withholds the whole total: summing around it would
 * reconcile against a figure the user never typed.
 */
export function summarizeAccounts(
  amountTexts: readonly string[],
): AccountsSummary {
  let totalCents = 0;
  let validCount = 0;
  for (const text of amountTexts) {
    const amount = parseAccountAmount(text);
    if (amount.status === 'invalid') {
      return { totalCents: null, canContinue: false };
    }
    if (amount.status === 'valid') {
      totalCents += amount.cents;
      validCount += 1;
    }
  }
  return validCount === 0
    ? { totalCents: null, canContinue: false }
    : { totalCents, canContinue: true };
}

/**
 * Never a saving: the gap is money the ledger does not know about, which came
 * in or went out — it was not set aside.
 */
export type ReconciliationVerdict =
  | { readonly kind: 'upToDate' }
  | { readonly kind: 'income' | 'expense'; readonly amount: number };

/**
 * Settled in cents on both sides, with no tolerance: one cent apart is a cent
 * the user can still see in their banking app.
 */
export function reconciliationVerdict(
  totalCents: number,
  realizedBalance: number,
): ReconciliationVerdict {
  const gap = moneyDifference(totalCents / CENTS_PER_UNIT, realizedBalance);
  if (gap === 0) return { kind: 'upToDate' };
  return gap > 0
    ? { kind: 'income', amount: gap }
    : { kind: 'expense', amount: -gap };
}

type FormulaLines = Parameters<
  typeof BudgetFormulas.calculateRealizedBalance
>[0];
type FormulaTransaction = NonNullable<
  Parameters<typeof BudgetFormulas.calculateRealizedBalance>[1]
>[number];

const MAX_POINTING_CANDIDATES = 3;

export interface PointingTarget {
  readonly kind: 'transaction' | 'budgetLine';
  readonly id: string;
}

/**
 * What pointing each target moves in the pointed balance, in order, against
 * one balance before pointing. Measured rather than read from the amount:
 * under a pointée prévision a dépense moves the balance by less, or not at
 * all. Server only (previous months' items): no Swift twin.
 */
export function pointingEffects(
  budgetLines: FormulaLines,
  transactions: readonly (FormulaTransaction & { readonly id: string })[],
  targets: readonly PointingTarget[],
): number[] {
  const balanceBefore = BudgetFormulas.calculateRealizedBalance(budgetLines, [
    ...transactions,
  ]);
  return targets.map((target) =>
    effectAfterPointing(budgetLines, transactions, balanceBefore, target),
  );
}

/** One target's effect against a balance before pointing computed once for a whole ranking. */
function effectAfterPointing(
  budgetLines: readonly FormulaLines[number][],
  transactions: readonly (FormulaTransaction & { readonly id: string })[],
  balanceBefore: number,
  target: PointingTarget,
): number {
  const checkedAt = new Date(0).toISOString();
  const after = BudgetFormulas.calculateRealizedBalance(
    budgetLines.map((line) =>
      target.kind === 'budgetLine' && line.id === target.id
        ? { ...line, checkedAt }
        : line,
    ),
    transactions.map((t) =>
      target.kind === 'transaction' && t.id === target.id
        ? { ...t, checkedAt }
        : t,
    ),
  );
  // Each balance is rounded to the cent first, then subtracted: the Swift twin does the same.
  return moneyDifference(after, balanceBefore);
}

interface Effect {
  readonly effect: number;
}

/**
 * Keeps the items whose effect moves the gap toward zero without crossing it,
 * closest to settling first (stable on ties), at most three.
 */
function rankByRemainingGap<T extends Effect>(
  gap: number,
  entries: readonly T[],
): (T & { readonly remainingGap: number })[] {
  return entries
    .filter(
      ({ effect }) =>
        effect !== 0 &&
        Math.sign(effect) === Math.sign(gap) &&
        Math.abs(effect) <= Math.abs(gap),
    )
    .map((entry) => ({
      ...entry,
      remainingGap: moneyDifference(gap, entry.effect),
    }))
    .sort((a, b) => Math.abs(a.remainingGap) - Math.abs(b.remainingGap))
    .slice(0, MAX_POINTING_CANDIDATES);
}

/** An unchecked item of a previous month, with the effect the server measured. */
export interface PriorPointingItem {
  readonly id: string;
  readonly effect: number;
  readonly monthsAgo: 1 | 2;
}

export type PointingSource = 'transaction' | 'budgetLine' | 'prior';

export interface RankedPointingCandidate {
  readonly source: PointingSource;
  readonly id: string;
  /** `0` for the month itself, `1` or `2` for a previous budget. */
  readonly monthsAgo: 0 | 1 | 2;
  readonly remainingGap: number;
}

/**
 * The items not pointed yet that most likely explain the gap: each one,
 * pointed alone, moves the pointed balance toward the accounts total without
 * going past it. An adjustment written instead would count them twice once
 * they are pointed. Three sources: unchecked budget lines, unchecked movements
 * of the month, then prior items; closest to settling first (ties keep that
 * source order), at most three.
 */
export function rankedPointingCandidates(
  gap: number,
  budgetLines: readonly (FormulaLines[number] & {
    readonly sourceSavingsGoalId?: string | null;
  })[],
  transactions: readonly (FormulaTransaction & { readonly id: string })[],
  priorItems: readonly PriorPointingItem[] = [],
): RankedPointingCandidate[] {
  if (gap === 0) return [];
  const balanceBefore = BudgetFormulas.calculateRealizedBalance(
    [...budgetLines],
    [...transactions],
  );
  const entries = [
    // A planned savings withdrawal is realized by its real income: the API refuses to check it.
    ...budgetLines
      .filter((line) => line.checkedAt == null && !line.sourceSavingsGoalId)
      .map((line) => ({
        source: 'budgetLine' as const,
        id: line.id,
        monthsAgo: 0 as const,
        effect: effectAfterPointing(budgetLines, transactions, balanceBefore, {
          kind: 'budgetLine',
          id: line.id,
        }),
      })),
    ...transactions
      .filter((transaction) => transaction.checkedAt == null)
      .map((transaction) => ({
        source: 'transaction' as const,
        id: transaction.id,
        monthsAgo: 0 as const,
        effect: effectAfterPointing(budgetLines, transactions, balanceBefore, {
          kind: 'transaction',
          id: transaction.id,
        }),
      })),
    ...priorItems.map(({ id, effect, monthsAgo }) => ({
      source: 'prior' as const,
      id,
      monthsAgo,
      effect,
    })),
  ];
  return rankByRemainingGap(gap, entries).map(
    ({ source, id, monthsAgo, remainingGap }) => ({
      source,
      id,
      monthsAgo,
      remainingGap,
    }),
  );
}

/** In the budget currency. */
const SMALL_GAP_THRESHOLD = 10;
const SALARY_EARLY_DAYS = 5;

/**
 * Money that came in while the next pay day is close: the salary may simply
 * have arrived before Pulpe expected it. A pay day of 1 is the calendar month,
 * which has no "early".
 */
export function isSalaryMaybeEarly(input: {
  readonly gap: number;
  readonly payDayOfMonth: number | null;
  readonly daysUntilNextPeriod: number;
}): boolean {
  return (
    input.gap > 0 &&
    input.payDayOfMonth != null &&
    input.payDayOfMonth !== 1 &&
    input.daysUntilNextPeriod <= SALARY_EARLY_DAYS
  );
}

export type ComparisonScreen =
  | 'matched'
  | 'suggestions'
  | 'firstComparison'
  | 'salaryEarly'
  | 'smallGap'
  | 'largeGap'
  | 'moreOnAccounts';

/** Which step-2 screen shows; first matching row wins (spec.md §4.3). */
export function comparisonScreen(input: {
  readonly gap: number;
  readonly candidateCount: number;
  readonly dismissed: boolean;
  readonly first: boolean;
  readonly salaryMaybeEarly: boolean;
}): ComparisonScreen {
  const { gap } = input;
  if (gap === 0) return 'matched';
  if (input.candidateCount > 0 && !input.dismissed) return 'suggestions';
  if (gap > 0 && input.first) return 'firstComparison';
  if (gap > 0 && input.salaryMaybeEarly) return 'salaryEarly';
  if (Math.abs(gap) < SMALL_GAP_THRESHOLD) return 'smallGap';
  return gap < 0 ? 'largeGap' : 'moreOnAccounts';
}

/** What Pulpe holds to be compared with the accounts: checked balance, prior correction, starting amount. */
export function comparedFigure(
  realizedBalance: number,
  priorCorrection: number,
  startingAmount: number,
): number {
  // Rounded once after the sum, like the Swift twin.
  return moneyDifference(realizedBalance + priorCorrection + startingAmount, 0);
}

/** « Disponible : avant → après »: the available amount before and after noting the gap. */
export function availableAfterNote(
  available: number,
  gap: number,
): { readonly before: number; readonly after: number } {
  return { before: available, after: moneyDifference(available + gap, 0) };
}

/**
 * « X trouvés »: how much nearer zero the checks of this comparison brought the
 * gap. A check that widens it finds nothing: accounts 1 000, Pulpe 950 then
 * 1 100 moves the gap from 50 to −100, so 0 is found.
 */
export function gapClosedByChecks(input: {
  readonly onAccounts: number;
  readonly comparedBefore: number;
  readonly compared: number;
}): number {
  const before = Math.abs(
    moneyDifference(input.onAccounts, input.comparedBefore),
  );
  const now = Math.abs(moneyDifference(input.onAccounts, input.compared));
  return Math.max(0, moneyDifference(before, now));
}

export interface PartlySpentBudgetLine {
  readonly id: string;
  readonly spent: number;
  readonly left: number;
}

/**
 * Checked expense lines whose allocated movements (checked or not, as the
 * line's consumption counts them) are above 0 and below the line: the rest of
 * the envelope is still there, which is normal (spec.md §4.4).
 */
export function partlySpentBudgetLines(
  budgetLines: readonly (FormulaLines[number] & { readonly id: string })[],
  transactions: readonly FormulaTransaction[],
): PartlySpentBudgetLine[] {
  return budgetLines
    .filter((line) => line.kind === 'expense' && line.checkedAt != null)
    .flatMap((line) => {
      const spent = moneyDifference(
        BudgetFormulas.calculateConsumption(line, [...transactions]).allocated,
        0,
      );
      return spent > 0 && spent < line.amount
        ? [{ id: line.id, spent, left: moneyDifference(line.amount, spent) }]
        : [];
    });
}

export interface MatchedBreakdown {
  /** Signed: below 0 is « Encore prévu », above 0 is « Encore à recevoir », 0 shows no line. */
  readonly stillPlanned: number;
  /** « D'avant Pulpe »: minus the starting amount, 0 shows no line. */
  readonly beforePulpe: number;
  readonly remaining: number;
}

/** The card under « Pareil des deux côtés » (spec.md §4.4). */
export function matchedBreakdown(input: {
  readonly available: number;
  readonly compared: number;
  readonly startingAmount: number;
}): MatchedBreakdown {
  return {
    stillPlanned: moneyDifference(
      input.available - input.compared + input.startingAmount,
      0,
    ),
    beforePulpe: moneyDifference(0, input.startingAmount),
    remaining: input.available,
  };
}
