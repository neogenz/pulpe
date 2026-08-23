/**
 * BALANCE TRAJECTORY TESTS — mêmes fixtures numériques que
 * `ios/PulpeTests/Domain/Formulas/BalanceTrajectoryTests.swift`, pour qu'une
 * divergence entre les deux implémentations sorte comme une assertion rouge et
 * pas comme un exercice de lecture.
 */

import { describe, expect, it } from 'vitest';
import { BudgetFormulas } from './budget-formulas.js';
import {
  calculateBalanceTrajectory,
  trendBalance,
  PRIOR_WARMUP_DAYS,
} from './balance-trajectory.js';
import type { DriftHistory } from '../../schemas.js';
import type { TransactionKind } from '../types.js';
import type { BalanceTrajectory } from './balance-trajectory.js';

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
  checkedAt?: string | null;
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
  checkedAt = null,
}: TransactionOptions) {
  return {
    amount,
    kind,
    budgetLineId,
    transactionDate: noon(year, month, day).toISOString(),
    checkedAt,
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

describe('real series', () => {
  it("ouvre sur ce que la période avait et tient tant que rien n'est pointé", () => {
    const trajectory = julyTrajectory([]);

    expect(trajectory?.plannedAvailable).toBe(5000);
    expect(new Set(trajectory!.real.map((point) => point.balance))).toEqual(
      new Set([5000]),
    );
    expect(trajectory?.real.map((point) => point.day)).toEqual(
      Array.from({ length: 16 }, (_, index) => index),
    );
  });

  it('descend le jour où une ligne est pointée, et ignore une prévision pas encore confirmée', () => {
    const rent = {
      id: 'rent',
      amount: 2000,
      kind: 'expense' as const,
      checkedAt: noon(2026, 7, 5).toISOString(),
    };
    const food = { id: 'food', amount: 500, kind: 'expense' as const };
    const trajectory = julyTrajectory([], [LINES[0], rent, food]);

    const byDay = new Map(
      trajectory!.real.map((point) => [point.day, point.balance]),
    );
    // Index d couvre le jour d (le jour 1 est le jour de paie) : le pointage
    // du 5 apparaît à partir de l'index 5.
    expect(byDay.get(4)).toBe(5000);
    expect(byDay.get(5)).toBe(3000);
    expect(byDay.get(15)).toBe(3000);
  });

  it('descend sur une transaction pointée, pas sur une non pointée', () => {
    const pointed = transaction({
      amount: 120,
      day: 8,
      checkedAt: noon(2026, 7, 8).toISOString(),
    });
    const pending = transaction({ amount: 60, day: 9 });
    const trajectory = julyTrajectory([pointed, pending]);

    const byDay = new Map(
      trajectory!.real.map((point) => [point.day, point.balance]),
    );
    expect(byDay.get(7)).toBe(5000);
    expect(byDay.get(8)).toBe(4880);
    expect(byDay.get(15)).toBe(4880);
  });

  it('la dernière lecture est le montant ouvert moins tout ce qui est réalisé', () => {
    const rent = {
      id: 'rent',
      amount: 2000,
      kind: 'expense' as const,
      checkedAt: noon(2026, 7, 2).toISOString(),
    };
    const transactions = [transaction({ amount: 800, day: 5 })];
    const budgetLines = [LINES[0], rent, LINES[2]];
    const trajectory = julyTrajectory(transactions, budgetLines);

    const realized = BudgetFormulas.calculateRealizedExpenses(
      budgetLines,
      transactions,
    );
    const last = trajectory!.real[trajectory!.real.length - 1];
    expect(last.balance).toBe(5000 - realized);
  });
});

describe('trendBalance', () => {
  const history = (
    drift: number,
    months: number,
    strength: number,
    mad: number,
  ): DriftHistory => ({
    usualOutflowDrift: drift,
    closedMonths: months,
    priorStrength: strength,
    driftMad: mad,
    driftProfile: [0.25, 0.5, 0.75, 1],
  });

  function trajectoryFromLanding(
    landing: number[],
    {
      plannedOutflows = 0,
      totalDays,
    }: { plannedOutflows?: number; totalDays?: number } = {},
  ): BalanceTrajectory {
    const today = Math.max(landing.length - 1, 1);
    const points = landing.map((balance, day) => ({ day, balance }));
    // Le trait réel s'ouvre sur ce que la période avait et suit le même
    // écart, pour qu'une fixture écrite en termes d'atterrissage dessine
    // quand même un burn-down cohérent.
    const opening = (landing[0] ?? 0) + plannedOutflows;
    return {
      landing: points,
      plannedAvailable: opening,
      real: points.map((point) => ({
        day: point.day,
        balance: opening + point.balance - (landing[0] ?? 0),
      })),
      driftDate: null,
      plannedOutflows,
      today,
      totalDays: totalDays ?? today + 1,
      plannedBalance: points[0]?.balance ?? 0,
      estimatedBalance: points[points.length - 1]?.balance ?? 0,
      drift:
        (points[points.length - 1]?.balance ?? 0) - (points[0]?.balance ?? 0),
    };
  }

  it('porte le rythme du jour sur les jours restants, réduit selon ce qui est peu connu', () => {
    // Jour 10 sur 31, 700 sous le plan : 70/jour, pondéré 10/(10+7), sur les 21 jours restants.
    const mid = trajectoryFromLanding([...Array(10).fill(2500), 1800], {
      totalDays: 31,
    });
    const expected = round2(1800 + -70 * (10 / 17) * 21);
    expect(trendBalance(mid, 7)).toBe(expected);

    // Jour 1 avec le même écart est surtout du bruit : le prior du plan le limite à 1/8 du rythme brut.
    const early = trajectoryFromLanding([2500, 1800], { totalDays: 31 });
    const raw = 1800 - 700 * 30;
    expect(trendBalance(early, 7)).toBe(round2(1800 - (700 / 8) * 30));
    expect(trendBalance(early, 7)).toBeGreaterThan(raw);
    expect(trendBalance(early, 0)).toBe(raw);

    // Un mois tenu atterrit sur son estimation ; pareil pour le dernier jour, quel que soit l'écart.
    expect(
      trendBalance(trajectoryFromLanding([2500, 2500], { totalDays: 31 }), 7),
    ).toBe(2500);
    expect(
      trendBalance(trajectoryFromLanding([2500, 1800], { totalDays: 1 }), 7),
    ).toBe(1800);
  });

  it("penche vers l'écart habituel, pondéré par la force du prior", () => {
    const landing = [...Array(10).fill(2500), 1800];
    const plain = trajectoryFromLanding(landing, {
      plannedOutflows: 9000,
      totalDays: 31,
    });
    const withHistory = history(-0.08, 6, 7, 10_000);
    const bent = trajectoryFromLanding(landing, {
      plannedOutflows: 9000,
      totalDays: 31,
    });

    const weight = 10 / 17;
    const prior = (6 / 8) * -0.08 * 9000 * (21 / 31);
    const paceTerm = weight * -70 * 21;
    const expected = round2(1800 + paceTerm + (1 - weight) * prior);
    expect(trendBalance(bent, 7, withHistory)).toBe(expected);
    expect(trendBalance(bent, 7, withHistory)).toBeLessThan(
      trendBalance(plain, 7),
    );

    // Un mois clos compte pour un tiers du prior, douze pour six septièmes.
    const one = trendBalance(bent, 7, history(-0.08, 1, 7, 10_000));
    const twelve = trendBalance(bent, 7, history(-0.08, 12, 7, 10_000));
    expect(twelve).toBeLessThan(one);
    expect(one).toBeLessThan(trendBalance(plain, 7));

    // Un K plus fort penche davantage vers l'historique et moins vers le rythme du mois.
    const strong = trendBalance(bent, 7, history(-0.08, 6, 14, 10_000));
    const strongPull = Math.abs(strong - 1800);
    const bentPull = Math.abs(trendBalance(bent, 7, withHistory) - 1800);
    expect(strongPull).toBeLessThan(bentPull);
  });

  it('reste plate avant le septième jour, puis infléchit', () => {
    const withHistory = history(-0.08, 6, 7, 10_000);
    const daySix = trajectoryFromLanding([...Array(6).fill(2500), 1800], {
      plannedOutflows: 9000,
      totalDays: 31,
    });
    expect(trendBalance(daySix, 7, withHistory)).toBe(1800);
    expect(daySix.today).toBeLessThan(PRIOR_WARMUP_DAYS);

    const daySeven = trajectoryFromLanding([...Array(7).fill(2500), 1800], {
      plannedOutflows: 9000,
      totalDays: 31,
    });
    expect(trendBalance(daySeven, 7, withHistory)).toBeLessThan(1800);

    // Un mois tenu avec un historique penche quand même : le prior est ce que l'utilisateur fait d'habitude.
    const held = trajectoryFromLanding(Array(11).fill(2500), {
      plannedOutflows: 9000,
      totalDays: 31,
    });
    expect(trendBalance(held, 7, withHistory)).toBeLessThan(2500);
  });

  it('le prior ne dépasse jamais le MAD, et un rythme nul revient au cas sans historique', () => {
    const landing = [...Array(10).fill(2500), 1800];
    const huge = trajectoryFromLanding(landing, {
      plannedOutflows: 9000,
      totalDays: 31,
    });
    const weight = 10 / 17;
    const capped = round2(1800 + weight * -70 * 21 + (1 - weight) * -50);
    expect(trendBalance(huge, 7, history(-5, 12, 7, 50))).toBe(capped);

    // Des mois alternés annulent le taux côté serveur ; à K égal la ligne est celle du jour.
    const zero = trajectoryFromLanding(landing, {
      plannedOutflows: 9000,
      totalDays: 31,
    });
    const plain = trajectoryFromLanding(landing, {
      plannedOutflows: 9000,
      totalDays: 31,
    });
    expect(trendBalance(zero, 7, history(0, 4, 7, 400))).toBe(
      trendBalance(plain, 7),
    );
  });
});

/** Même arrondi que `round2` interne au calculateur, dupliqué ici volontairement
 * pour que le test n'importe pas un détail privé. */
function round2(value: number): number {
  return value >= 0
    ? Math.round(value * 100) / 100
    : -Math.round(-value * 100) / 100;
}
