import { describe, expect, it } from 'vitest';

import {
  parseAccountAmount,
  reconciliationVerdict,
  summarizeAccounts,
} from './reconcile-accounts';

describe('parseAccountAmount', () => {
  it.each([
    ['1234.56', 123456],
    ['1234,56', 123456],
    ['0.1', 10],
    ['-0.01', -1],
    ['-80.5', -8050],
    ['−12', -1200],
    [' 42 ', 4200],
    ['999999999.99', 99999999999],
  ])('should read %j as %d cents', (text, cents) => {
    expect(parseAccountAmount(text)).toEqual({ status: 'valid', cents });
  });

  it.each(['', '   '])('should treat %j as a blank amount', (text) => {
    expect(parseAccountAmount(text)).toEqual({ status: 'blank' });
  });

  it.each([
    '-',
    '12.',
    ',5',
    '1.234',
    '1e3',
    'Infinity',
    'NaN',
    '12abc',
    '1 000',
    '1.2.3',
    '--5',
    '+5',
    '1000000000',
  ])('should refuse %j instead of reading it as zero', (text) => {
    expect(parseAccountAmount(text)).toEqual({ status: 'invalid' });
  });
});

describe('summarizeAccounts', () => {
  it('should total several accounts, overdraft included, to the cent', () => {
    expect(summarizeAccounts(['0.1', '0.2', '-0.3', '1500', '-0.01'])).toEqual({
      totalCents: 149999,
      canContinue: true,
    });
  });

  it('should ignore blank rows next to a valid amount', () => {
    expect(summarizeAccounts(['', '250.40', '  '])).toEqual({
      totalCents: 25040,
      canContinue: true,
    });
  });

  it('should hold the user back while no amount is typed', () => {
    expect(summarizeAccounts(['', ' '])).toEqual({
      totalCents: null,
      canContinue: false,
    });
  });

  it('should not let a valid or blank row conceal an invalid one', () => {
    expect(summarizeAccounts(['1200', '', '12.'])).toEqual({
      totalCents: null,
      canContinue: false,
    });
  });
});

describe('reconciliationVerdict', () => {
  it('should propose an income for what the accounts hold beyond the balance', () => {
    expect(reconciliationVerdict(150_000, 1499.99)).toEqual({
      kind: 'income',
      amount: 0.01,
    });
  });

  it('should propose an expense for what the accounts are missing', () => {
    expect(reconciliationVerdict(-5_000, 120.3)).toEqual({
      kind: 'expense',
      amount: 170.3,
    });
  });

  it('should settle 0.1 + 0.2 against 0.30 as up to date, with no tolerance', () => {
    expect(reconciliationVerdict(30, 0.1 + 0.2)).toEqual({ kind: 'upToDate' });
    expect(reconciliationVerdict(31, 0.3)).toEqual({
      kind: 'income',
      amount: 0.01,
    });
    expect(reconciliationVerdict(29, 0.3)).toEqual({
      kind: 'expense',
      amount: 0.01,
    });
  });
});
