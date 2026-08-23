/**
 * BALANCE TRAJECTORY TESTS — mêmes fixtures numériques que
 * `ios/PulpeTests/Domain/Formulas/BalanceTrajectoryTests.swift`, pour qu'une
 * divergence entre les deux implémentations sorte comme une assertion rouge et
 * pas comme un exercice de lecture.
 */

import { describe, expect, it } from 'vitest';
import { BudgetFormulas } from './budget-formulas.js';
import { calculateBalanceTrajectory } from './balance-trajectory.js';
import type { TransactionKind } from '../types.js';

interface Line {
  id: string;
  amount: number;
  kind: TransactionKind;
  isRollover?: boolean;
  /** Jamais lu par la trajectoire — c'est précisément ce qu'un cas vérifie. */
  checkedAt?: string | null;
}

// 5 000 en entrée, 2 500 en sortie : le plan atterrit sur 2 500, et tous les
// cas ci-dessous se lisent contre cette valeur.
const LINES: Line[] = [
  { id: 'salary', amount: 5000, kind: 'income' },
  { id: 'rent', amount: 2000, kind: 'expense' },
  { id: 'food', amount: 500, kind: 'expense' },
];

const JULY_2026 = { month: 7, year: 2026 };

interface TransactionOptions {
  amount: number;
  kind?: TransactionKind;
  budgetLineId?: string | null;
  year?: number;
  month?: number;
  day: number;
}

/** Midi, comme le suite Swift : jamais au bord d'un début de journée. */
function noon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12);
}

function transaction({
  amount,
  kind = 'expense',
  budgetLineId = null,
  year = 2026,
  month = 7,
  day,
}: TransactionOptions) {
  return {
    amount,
    kind,
    budgetLineId,
    transactionDate: noon(year, month, day).toISOString(),
  };
}

function julyTrajectory(
  transactions: ReturnType<typeof transaction>[],
  budgetLines: Line[] = LINES,
) {
  return calculateBalanceTrajectory({
    budgetLines,
    transactions,
    budget: JULY_2026,
    payDayOfMonth: null,
    referenceDate: noon(2026, 7, 15),
  });
}

function balances(trajectory: { landing: { balance: number }[] }): number[] {
  return trajectory.landing.map((point) => point.balance);
}

describe('calculateBalanceTrajectory', () => {
  it("ouvre sur le plan et arrive sur l'estimation", () => {
    const transactions = [transaction({ amount: 800, day: 5 })];
    const trajectory = julyTrajectory(transactions);

    const planned = BudgetFormulas.calculateAllMetrics(LINES).remaining;
    const estimated = BudgetFormulas.calculateAllMetrics(
      LINES,
      transactions,
    ).remaining;

    expect(trajectory?.plannedBalance).toBe(planned);
    expect(trajectory?.estimatedBalance).toBe(estimated);
    expect(trajectory?.drift).toBe(estimated - planned);
    expect(trajectory?.landing.map((point) => point.day)).toEqual(
      Array.from({ length: 16 }, (_, index) => index),
    );
  });

  it("tient son plan tant que rien n'a été dépensé", () => {
    const trajectory = julyTrajectory([]);

    expect(new Set(balances(trajectory!))).toEqual(new Set([2500]));
    expect(trajectory?.drift).toBe(0);
    expect(trajectory?.driftDate).toBeNull();
  });

  it('ne bouge pas quand une opération est seulement pointée', () => {
    const pointed = LINES.map((line) =>
      line.id === 'food'
        ? line
        : { ...line, checkedAt: '2026-07-03T12:00:00Z' },
    );
    const trajectory = julyTrajectory(
      [transaction({ amount: 2000, budgetLineId: 'rent', day: 3 })],
      pointed,
    );

    expect(new Set(balances(trajectory!))).toEqual(new Set([2500]));
    expect(trajectory?.driftDate).toBeNull();
  });

  it('descend le jour où une enveloppe est dépassée', () => {
    const trajectory = julyTrajectory([
      transaction({ amount: 800, budgetLineId: 'food', day: 5 }),
    ]);

    expect(balances(trajectory!).slice(0, 5)).toEqual([
      2500, 2500, 2500, 2500, 2500,
    ]);
    expect(new Set(balances(trajectory!).slice(5))).toEqual(new Set([2200]));
    expect(trajectory?.driftDate).toEqual(new Date(2026, 6, 5));
    expect(trajectory?.drift).toBe(-300);
  });

  it('monte quand un revenu dépasse son plan', () => {
    const trajectory = julyTrajectory([
      transaction({ amount: 400, kind: 'income', day: 9 }),
    ]);

    expect(trajectory?.drift).toBe(400);
    expect(trajectory?.driftDate).toEqual(new Date(2026, 6, 9));
  });

  it('compte une transaction mal datée le jour où le hero la compte', () => {
    const trajectory = julyTrajectory([
      transaction({ amount: 300, month: 6, day: 28 }),
    ]);

    expect(trajectory?.plannedBalance).toBe(2500);
    expect(trajectory?.estimatedBalance).toBe(2200);
    expect(new Set(balances(trajectory!).slice(0, -1))).toEqual(
      new Set([2500]),
    );
  });

  it('somme les sorties prévues de la période seule', () => {
    const trajectory = julyTrajectory(
      [],
      [
        ...LINES,
        { id: 'report', amount: 900, kind: 'expense', isRollover: true },
      ],
    );

    expect(trajectory?.plannedOutflows).toBe(2500);
  });

  it("n'inclut que les transactions de sa période à cheval sur deux mois", () => {
    const trajectory = calculateBalanceTrajectory({
      budgetLines: LINES,
      transactions: [
        transaction({ amount: 25, year: 2026, month: 2, day: 26 }),
        transaction({ amount: 100, year: 2026, month: 2, day: 27 }),
        transaction({ amount: 50, year: 2026, month: 3, day: 1 }),
      ],
      budget: { month: 3, year: 2026 },
      payDayOfMonth: 27,
      referenceDate: noon(2026, 3, 1),
    });

    expect(trajectory?.today).toBe(3);
    expect(trajectory?.totalDays).toBe(28);
    // Le jour 0 ne sait rien ; le jour 1 couvre le 27, donc les 100 dépensés ce
    // jour-là y sont déjà. La dernière lecture est celle du hero, donc elle
    // porte aussi les 25 datés avant la période.
    expect(balances(trajectory!)).toEqual([2500, 2400, 2400, 2325]);
  });

  it('utilise le mois calendaire suivant pour une paie de première quinzaine', () => {
    const trajectory = calculateBalanceTrajectory({
      budgetLines: LINES,
      transactions: [],
      budget: { month: 3, year: 2026 },
      payDayOfMonth: 5,
      referenceDate: noon(2026, 4, 2),
    });

    expect(trajectory?.today).toBe(29);
    expect(trajectory?.totalDays).toBe(31);
  });

  it("inclut chaque bout de période exactement une fois au passage d'année", () => {
    const trajectory = calculateBalanceTrajectory({
      budgetLines: LINES,
      transactions: [
        transaction({ amount: 100, year: 2025, month: 12, day: 27 }),
        transaction({ amount: 50, year: 2026, month: 1, day: 26 }),
      ],
      budget: { month: 1, year: 2026 },
      payDayOfMonth: 27,
      referenceDate: noon(2026, 1, 26),
    });

    expect(trajectory?.today).toBe(31);
    expect(trajectory?.totalDays).toBe(31);
    expect(trajectory?.plannedBalance).toBe(2500);
    expect(trajectory?.estimatedBalance).toBe(2350);
  });

  it('est absente hors de sa propre période', () => {
    expect(
      calculateBalanceTrajectory({
        budgetLines: LINES,
        transactions: [],
        budget: JULY_2026,
        payDayOfMonth: null,
        referenceDate: noon(2026, 9, 1),
      }),
    ).toBeNull();
  });
});
