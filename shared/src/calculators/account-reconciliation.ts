/**
 * @fileoverview "Rapprocher mes comptes" (PUL-351): the bank balances a user
 * types, held against the checked balance of the loaded month. Runs under the
 * finger — the total and the verdict follow every keystroke — so the web and
 * Android clients import it from here.
 *
 * SWIFT TWIN: `parseAmount`, `totalCents(of:)`, `verdict` and
 * `pointingCandidates` in
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

export interface PointingCandidate<T> {
  readonly transaction: T;
  /** The gap once this one is pointed: `0` settles it. */
  readonly remainingGap: number;
}

/**
 * The movements not pointed yet that most likely explain the gap: each one,
 * pointed alone, moves the pointed balance toward the accounts total without
 * going past it. An adjustment written instead would count them twice once
 * they are pointed. The effect is measured, not read from the amount: under a
 * pointée prévision a dépense moves the balance by less, or not at all.
 * Closest to settling first, at most three.
 */
export function pointingCandidates<
  T extends FormulaTransaction & { readonly id: string },
>(
  gap: number,
  budgetLines: FormulaLines,
  transactions: readonly T[],
): PointingCandidate<T>[] {
  if (gap === 0) return [];
  const balance = BudgetFormulas.calculateRealizedBalance(budgetLines, [
    ...transactions,
  ]);
  return transactions
    .filter((transaction) => transaction.checkedAt == null)
    .map((transaction) => {
      const pointed = transactions.map((t) =>
        t.id === transaction.id
          ? { ...t, checkedAt: new Date(0).toISOString() }
          : t,
      );
      const effect = moneyDifference(
        BudgetFormulas.calculateRealizedBalance(budgetLines, pointed),
        balance,
      );
      return { transaction, effect };
    })
    .filter(
      ({ effect }) =>
        effect !== 0 &&
        Math.sign(effect) === Math.sign(gap) &&
        Math.abs(effect) <= Math.abs(gap),
    )
    .map(({ transaction, effect }) => ({
      transaction,
      remainingGap: moneyDifference(gap, effect),
    }))
    .sort((a, b) => Math.abs(a.remainingGap) - Math.abs(b.remainingGap))
    .slice(0, MAX_POINTING_CANDIDATES);
}
