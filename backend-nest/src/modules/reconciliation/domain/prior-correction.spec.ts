import { describe, expect, it } from 'bun:test';
import type {
  BudgetLineDecrypted,
  BudgetWithDetails,
  TransactionDecrypted,
} from '@modules/budget/domain/budget.entity';
import { priorCorrection } from './prior-correction';

const CHECKED = '2026-10-05T00:00:00.000Z';

const tx = (over: Partial<TransactionDecrypted>): TransactionDecrypted =>
  ({
    budgetLineId: null,
    kind: 'expense',
    checkedAt: null,
    ...over,
  }) as TransactionDecrypted;

const line = (over: Partial<BudgetLineDecrypted>): BudgetLineDecrypted =>
  ({
    kind: 'expense',
    checkedAt: null,
    sourceSavingsGoalId: null,
    ...over,
  }) as BudgetLineDecrypted;

const month = (
  id: string,
  endingBalance: number | null,
  budgetLines: BudgetLineDecrypted[],
  transactions: TransactionDecrypted[],
): BudgetWithDetails =>
  ({
    budget: { id, endingBalance },
    budgetLines,
    transactions,
  }) as BudgetWithDetails;

// October: 1 800 received, 800 of card purchases never checked, stored balance 1 000.
const october = month(
  'oct',
  1000,
  [],
  [
    tx({
      id: 'pay',
      name: 'Salaire',
      amount: 1800,
      kind: 'income',
      checkedAt: CHECKED,
    }),
    tx({ id: 'card', name: 'Carte', amount: 800 }),
  ],
);
// September: 500 received, a 40 pharmacy bill never checked, stored balance 460.
const september = month(
  'sep',
  460,
  [],
  [
    tx({
      id: 'pay2',
      name: 'Salaire',
      amount: 500,
      kind: 'income',
      checkedAt: CHECKED,
    }),
    tx({ id: 'pharmacy', name: 'Pharmacie', amount: 40 }),
  ],
);

describe('priorCorrection', () => {
  it('should add what each previous budget counted as spent but nobody checked', () => {
    const result = priorCorrection([
      { details: october, monthsAgo: 1 },
      { details: september, monthsAgo: 2 },
    ]);

    expect(result.priorCorrection).toBe(840);
    expect(result.priorItems).toEqual([
      {
        id: 'card',
        source: 'transaction',
        budgetId: 'oct',
        name: 'Carte',
        amount: 800,
        kind: 'expense',
        monthsAgo: 1,
        effect: -800,
      },
      {
        id: 'pharmacy',
        source: 'transaction',
        budgetId: 'sep',
        name: 'Pharmacie',
        amount: 40,
        kind: 'expense',
        monthsAgo: 2,
        effect: -40,
      },
    ]);
  });

  it('should be nothing for a first budget', () => {
    expect(priorCorrection([])).toEqual({ priorCorrection: 0, priorItems: [] });
  });

  it('should count a null stored ending balance as 0', () => {
    const result = priorCorrection([
      {
        details: month('m', null, [], [october.transactions[0]!]),
        monthsAgo: 1,
      },
    ]);

    expect(result.priorCorrection).toBe(1800);
  });

  it('should never list a planned savings withdrawal, which the API cannot check', () => {
    const withdrawal = line({
      id: 'withdrawal',
      name: 'Retrait épargne',
      amount: 100,
      kind: 'income',
      sourceSavingsGoalId: 'goal',
    });
    const plain = line({
      id: 'bonus',
      name: 'Prime',
      amount: 100,
      kind: 'income',
    });

    const { priorItems } = priorCorrection([
      { details: month('m', 0, [withdrawal, plain], []), monthsAgo: 1 },
    ]);

    expect(priorItems.map((i) => [i.id, i.effect])).toEqual([['bonus', 100]]);
  });

  it('should leave out an item whose check changes nothing', () => {
    const { priorItems } = priorCorrection([
      {
        details: month(
          'm',
          0,
          [line({ id: 'rent', amount: 100, checkedAt: CHECKED })],
          [tx({ id: 'inside', amount: 30, budgetLineId: 'rent' })],
        ),
        monthsAgo: 1,
      },
    ]);

    expect(priorItems).toEqual([]);
  });
});
