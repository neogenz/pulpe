import { describe, expect, it } from 'vitest';
import {
  availableAfterNote,
  comparedFigure,
  comparisonScreen,
  gapClosedByChecks,
  isSalaryMaybeEarly,
  matchedBreakdown,
  parseAccountAmount,
  partlySpentBudgetLines,
  pointingCandidates,
  pointingEffects,
  rankedPointingCandidates,
  reconciliationVerdict,
  summarizeAccounts,
} from './account-reconciliation.js';

// Same numeric fixtures as
// `ios/PulpeTests/Features/CurrentMonth/AccountReconciliationTests.swift`, so a
// drift between the twins fails an assertion on one side or the other.

describe('parseAccountAmount', () => {
  it.each(['', '   '])('reads %j as a blank amount', (text) => {
    expect(parseAccountAmount(text)).toEqual({ status: 'blank' });
  });

  it.each([
    ['12', 1_200],
    ['12,5', 1_250],
    ['12.05', 1_205],
    ['0.01', 1],
    [' 7 ', 700],
    ['0', 0],
    ['999999999.99', 99_999_999_999],
  ])('reads %j to the cent', (text, cents) => {
    expect(parseAccountAmount(text)).toEqual({ status: 'valid', cents });
  });

  it.each([
    ['-0.01', -1],
    ['−40', -4_000],
    ['-12,30', -1_230],
  ])('reads a typed or pasted minus in %j as an overdraft', (text, cents) => {
    expect(parseAccountAmount(text)).toEqual({ status: 'valid', cents });
  });

  it.each([
    '12.',
    '.5',
    '12,345',
    '1,234.5',
    "1'234",
    '1 234',
    'abc',
    '1e3',
    '12.3.4',
    '--5',
    '+5',
    '-',
    '1234567890',
    'NaN',
    'inf',
    'Infinity',
    '١٢',
  ])('refuses %j instead of reading it as zero', (text) => {
    expect(parseAccountAmount(text)).toEqual({ status: 'invalid' });
  });
});

describe('summarizeAccounts', () => {
  it('adds up in cents, so 0.1 + 0.2 is exactly 0.30', () => {
    expect(summarizeAccounts(['0.1', '0.2'])).toEqual({
      totalCents: 30,
      canContinue: true,
    });
  });

  it('subtracts an overdrawn account', () => {
    expect(summarizeAccounts(['1500.25', '-200,50', '0.01'])).toEqual({
      totalCents: 129_976,
      canContinue: true,
    });
  });

  it('skips blank rows, and still counts a zero balance', () => {
    expect(summarizeAccounts(['', '12', '  '])).toEqual({
      totalCents: 1_200,
      canContinue: true,
    });
    expect(summarizeAccounts(['0'])).toEqual({
      totalCents: 0,
      canContinue: true,
    });
  });

  it('has no total without one filled amount', () => {
    expect(summarizeAccounts([''])).toEqual({
      totalCents: null,
      canContinue: false,
    });
    expect(summarizeAccounts(['', ' '])).toEqual({
      totalCents: null,
      canContinue: false,
    });
  });

  it('withholds the total over one refused amount, even among blank rows', () => {
    expect(summarizeAccounts(['100', '', '12.'])).toEqual({
      totalCents: null,
      canContinue: false,
    });
    expect(summarizeAccounts(['', 'abc'])).toEqual({
      totalCents: null,
      canContinue: false,
    });
  });

  it('keeps nine-digit balances on several accounts exact', () => {
    expect(summarizeAccounts(Array(3).fill('999999999.99'))).toEqual({
      totalCents: 299_999_999_997,
      canContinue: true,
    });
  });
});

describe('reconciliationVerdict', () => {
  it('calls accounts equal to the balance to the cent up to date', () => {
    expect(reconciliationVerdict(30, 0.3)).toEqual({ kind: 'upToDate' });
  });

  it('quantizes float noise on the balance before comparing', () => {
    expect(reconciliationVerdict(30, 0.30000000000000004)).toEqual({
      kind: 'upToDate',
    });
    expect(reconciliationVerdict(30, 0.1 + 0.2)).toEqual({ kind: 'upToDate' });
  });

  it('turns one cent more on the accounts into a one-cent income, with no tolerance', () => {
    expect(reconciliationVerdict(125_041, 1250.4)).toEqual({
      kind: 'income',
      amount: 0.01,
    });
  });

  it('turns one cent less on the accounts into a one-cent expense, never a saving', () => {
    expect(reconciliationVerdict(125_039, 1250.4)).toEqual({
      kind: 'expense',
      amount: 0.01,
    });
  });

  it('compares an overdraft against a deeper checked deficit by sign', () => {
    expect(reconciliationVerdict(-15_000, -200)).toEqual({
      kind: 'income',
      amount: 50,
    });
  });

  it('keeps a large gap exact to the cent', () => {
    expect(reconciliationVerdict(299_999_999_997, 0)).toEqual({
      kind: 'income',
      amount: 2_999_999_999.97,
    });
  });
});

describe('pointingCandidates', () => {
  const movement = (
    id: string,
    kind: 'income' | 'expense',
    amount: number,
    options: { budgetLineId?: string; checkedAt?: string } = {},
  ) => ({
    id,
    kind,
    amount,
    budgetLineId: options.budgetLineId ?? null,
    checkedAt: options.checkedAt ?? null,
  });
  const ids = (candidates: { transaction: { id: string } }[]) =>
    candidates.map(({ transaction }) => transaction.id);

  it('names an income not pointed yet that explains most of the gap, and what would remain', () => {
    const bonus = movement('bonus', 'income', 800);
    const dinner = movement('dinner', 'expense', 50);

    expect(pointingCandidates(814.93, [], [bonus, dinner])).toEqual([
      { transaction: bonus, remainingGap: 14.93 },
    ]);
  });

  it('leaves out a movement that would go past the gap, or that is already pointed', () => {
    const big = movement('big', 'income', 900);
    const pointed = movement('pointed', 'income', 100, {
      checkedAt: '2026-11-01',
    });

    expect(pointingCandidates(814.93, [], [big, pointed])).toEqual([]);
    expect(pointingCandidates(0, [], [movement('any', 'income', 1)])).toEqual(
      [],
    );
  });

  it('puts the movement that settles the gap first', () => {
    const coffee = movement('coffee', 'expense', 20);
    const migros = movement('migros', 'expense', 84.3);

    expect(pointingCandidates(-84.3, [], [coffee, migros])).toEqual([
      { transaction: migros, remainingGap: 0 },
      { transaction: coffee, remainingGap: -64.3 },
    ]);
  });

  it('measures what pointing moves under a pointée prévision, not the amount', () => {
    const groceries = {
      id: 'groceries',
      kind: 'expense' as const,
      amount: 100,
      checkedAt: '2026-11-01',
    };
    const small = movement('small', 'expense', 50, {
      budgetLineId: 'groceries',
    });
    const big = movement('big', 'expense', 150, { budgetLineId: 'groceries' });

    expect(pointingCandidates(-150, [groceries], [small, big])).toEqual([
      { transaction: big, remainingGap: -100 },
    ]);
  });

  it('keeps three at most', () => {
    const four = ['a', 'b', 'c', 'd'].map((id) => movement(id, 'expense', 10));

    expect(ids(pointingCandidates(-100, [], four))).toEqual(['a', 'b', 'c']);
  });
});

describe('pointingEffects', () => {
  it('gives the effect of pointing each target, in order', () => {
    const lines = [
      {
        id: 'l1',
        kind: 'expense' as const,
        amount: 100,
        checkedAt: null,
        recurrence: 'fixed' as const,
      },
    ];
    const transactions = [
      {
        id: 't1',
        kind: 'expense' as const,
        amount: 30,
        budgetLineId: 'l1',
        checkedAt: null,
      },
      {
        id: 't2',
        kind: 'income' as const,
        amount: 50,
        budgetLineId: null,
        checkedAt: null,
      },
    ];
    const targets = [
      { kind: 'transaction' as const, id: 't2' },
      { kind: 'budgetLine' as const, id: 'l1' },
      { kind: 'transaction' as const, id: 't1' },
    ];

    expect(pointingEffects(lines, transactions, targets)).toEqual([
      50, -100, -30,
    ]);
    expect(pointingEffects(lines, transactions, [])).toEqual([]);
  });
});

describe('rankedPointingCandidates', () => {
  const line = (
    id: string,
    amount: number,
    checkedAt: string | null = null,
  ) => ({
    id,
    kind: 'expense' as const,
    amount,
    checkedAt,
  });
  const essence = {
    id: 'essence',
    kind: 'expense' as const,
    amount: 60,
    budgetLineId: null,
    checkedAt: null,
  };

  it('ranks budget lines, movements and prior items by what remains', () => {
    expect(
      rankedPointingCandidates(
        -100,
        [line('assurance', 100)],
        [essence],
        [{ id: 'pharmacie', effect: -40, monthsAgo: 1 }],
      ),
    ).toEqual([
      { source: 'budgetLine', id: 'assurance', monthsAgo: 0, remainingGap: 0 },
      { source: 'transaction', id: 'essence', monthsAgo: 0, remainingGap: -40 },
      { source: 'prior', id: 'pharmacie', monthsAgo: 1, remainingGap: -60 },
    ]);
  });

  it('names an eligible prior item two months back', () => {
    expect(
      rankedPointingCandidates(
        -100,
        [],
        [],
        [{ id: 'loyer', effect: -100, monthsAgo: 2 }],
      ),
    ).toEqual([
      { source: 'prior', id: 'loyer', monthsAgo: 2, remainingGap: 0 },
    ]);
  });

  it('leaves out a planned savings withdrawal, which the API refuses to check', () => {
    expect(
      rankedPointingCandidates(
        -100,
        [{ ...line('retrait', 100), sourceSavingsGoalId: 'goal' }],
        [],
      ),
    ).toEqual([]);
  });

  it('measures an effect near a cent boundary from the two rounded balances', () => {
    const income = (id: string, amount: number, checkedAt: string | null) => ({
      id,
      kind: 'income' as const,
      amount,
      checkedAt,
    });
    expect(
      rankedPointingCandidates(
        0.01,
        [income('a', 100.004, '2026-11-01'), income('b', 0.004, null)],
        [],
      ),
    ).toEqual([
      { source: 'budgetLine', id: 'b', monthsAgo: 0, remainingGap: 0 },
    ]);
  });

  it('leaves out a checked line, a prior item that goes past the gap, and a zero gap', () => {
    expect(
      rankedPointingCandidates(
        -100,
        [line('assurance', 100, '2026-11-01')],
        [],
        [{ id: 'loyer', effect: -150, monthsAgo: 2 }],
      ),
    ).toEqual([]);
    expect(rankedPointingCandidates(0, [line('assurance', 100)], [])).toEqual(
      [],
    );
  });
});

describe('comparisonScreen', () => {
  const screen = (
    gap: number,
    options: {
      candidateCount?: number;
      dismissed?: boolean;
      first?: boolean;
      salaryMaybeEarly?: boolean;
    } = {},
  ) =>
    comparisonScreen({
      gap,
      candidateCount: 0,
      dismissed: false,
      first: false,
      salaryMaybeEarly: false,
      ...options,
    });

  it.each([
    ['matched', 0, { candidateCount: 2 }],
    ['suggestions', -100, { candidateCount: 1 }],
    ['firstComparison', 3_100, { first: true }],
    ['salaryEarly', 6_000, { salaryMaybeEarly: true }],
    ['smallGap', -2.4, {}],
    ['smallGap', 3, {}],
    ['largeGap', -10, {}],
    ['moreOnAccounts', 6_000, {}],
    ['largeGap', -6_000, { salaryMaybeEarly: true }],
  ] as const)('shows %s at a gap of %d', (expected, gap, options) => {
    expect(screen(gap, options)).toBe(expected);
  });

  it('keeps the suggestions over the first comparison and the early salary', () => {
    expect(
      screen(6_000, {
        candidateCount: 1,
        first: true,
        salaryMaybeEarly: true,
      }),
    ).toBe('suggestions');
  });

  it('skips the suggestions once dismissed', () => {
    expect(screen(-100, { candidateCount: 1, dismissed: true })).toBe(
      'largeGap',
    );
  });

  it('puts the first comparison before the salary, and the salary before a small gap', () => {
    expect(screen(6_000, { first: true, salaryMaybeEarly: true })).toBe(
      'firstComparison',
    );
    expect(screen(3, { salaryMaybeEarly: true })).toBe('salaryEarly');
  });
});

describe('isSalaryMaybeEarly', () => {
  it.each([
    [6_000, 25, 3, true],
    [6_000, 25, 5, true],
    [6_000, 25, 6, false],
    [6_000, 1, 3, false],
    [6_000, null, 3, false],
    [-6_000, 25, 3, false],
  ])(
    'gap %d, pay day %s, %d days left is %s',
    (gap, payDay, days, expected) => {
      expect(
        isSalaryMaybeEarly({
          gap,
          payDayOfMonth: payDay,
          daysUntilNextPeriod: days,
        }),
      ).toBe(expected);
    },
  );
});

describe('comparedFigure and availableAfterNote', () => {
  it('adds the prior correction and the starting amount to the checked balance', () => {
    expect(comparedFigure(900, 50, 3_100)).toBe(4_050);
    expect(comparedFigure(900.1, -0.2, 0)).toBe(899.9);
    expect(comparedFigure(100.004, 0.004, 0)).toBe(100.01);
  });

  it('shows the available amount before and after noting the gap', () => {
    expect(availableAfterNote(1_250.4, -100)).toEqual({
      before: 1_250.4,
      after: 1_150.4,
    });
    expect(availableAfterNote(100.004, 0.004).after).toBe(100.01);
    expect(availableAfterNote(10.1, 0.2)).toEqual({
      before: 10.1,
      after: 10.3,
    });
  });
});

describe('gapClosedByChecks', () => {
  it.each([
    { onAccounts: 1_000, comparedBefore: 950, compared: 1_100, expected: 0 },
    { onAccounts: 1_000, comparedBefore: 950, compared: 980, expected: 30 },
    { onAccounts: 950, comparedBefore: 1_050, compared: 1_100, expected: 0 },
    { onAccounts: 950, comparedBefore: 1_050, compared: 1_000, expected: 50 },
    { onAccounts: 1_000, comparedBefore: 950, compared: 1_000, expected: 50 },
  ])(
    'finds $expected with accounts $onAccounts, Pulpe $comparedBefore then $compared',
    ({ expected, ...input }) => {
      expect(gapClosedByChecks(input)).toBe(expected);
    },
  );
});

describe('partlySpentBudgetLines', () => {
  it('counts every allocated movement, checked or not, as the line consumption does', () => {
    const checked = '2026-11-01';
    const partly = {
      id: 'partly',
      kind: 'expense' as const,
      amount: 600,
      checkedAt: checked,
    };
    const untouched = {
      id: 'untouched',
      kind: 'expense' as const,
      amount: 1_200,
      checkedAt: checked,
    };
    const spentAll = {
      id: 'spentAll',
      kind: 'expense' as const,
      amount: 300,
      checkedAt: checked,
    };
    const unchecked = {
      id: 'unchecked',
      kind: 'expense' as const,
      amount: 600,
      checkedAt: checked,
    };
    const open = {
      id: 'open',
      kind: 'expense' as const,
      amount: 600,
      checkedAt: null,
    };
    const spend = (
      budgetLineId: string,
      amount: number,
      checkedAt: string | null,
    ) => ({
      kind: 'expense' as const,
      amount,
      budgetLineId,
      checkedAt,
    });

    expect(
      partlySpentBudgetLines(
        [partly, untouched, spentAll, open, unchecked],
        [
          spend('partly', 200, checked),
          spend('partly', 50, null),
          spend('open', 100, checked),
          spend('spentAll', 300, checked),
          spend('unchecked', 200, null),
        ],
      ),
    ).toEqual([
      { id: 'partly', spent: 250, left: 350 },
      { id: 'unchecked', spent: 200, left: 400 },
    ]);
  });
});

describe('matchedBreakdown', () => {
  it('splits what is left to spend from what Pulpe still plans and what came before it', () => {
    expect(
      matchedBreakdown({
        available: 900,
        compared: 4_050,
        startingAmount: 3_100,
      }),
    ).toEqual({ stillPlanned: -50, beforePulpe: -3_100, remaining: 900 });
  });

  it('rounds the planned remainder once, near a cent boundary', () => {
    expect(
      matchedBreakdown({
        available: 100.004,
        compared: 0.004,
        startingAmount: 0,
      }).stillPlanned,
    ).toBe(100);
    expect(
      matchedBreakdown({ available: 0.004, compared: 0, startingAmount: 0.006 })
        .stillPlanned,
    ).toBe(0.01);
  });

  it('shows nothing extra when everything lines up', () => {
    expect(
      matchedBreakdown({ available: 900, compared: 900, startingAmount: 0 }),
    ).toEqual({ stillPlanned: 0, beforePulpe: 0, remaining: 900 });
  });

  it('reads a positive remainder as still to receive', () => {
    expect(
      matchedBreakdown({ available: 1_000, compared: 950, startingAmount: 0 })
        .stillPlanned,
    ).toBe(50);
  });
});
