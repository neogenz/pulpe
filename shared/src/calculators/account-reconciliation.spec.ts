import { describe, expect, it } from 'vitest';
import {
  parseAccountAmount,
  pointingCandidates,
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
