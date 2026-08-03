/**
 * SAVINGS GOAL PROGRESS TESTS - Les 9 formules de progression (PUL-8)
 *
 * Verrouille les pièges de docs/SAVINGS.md §4 :
 * kind-strict, pas de free-transaction, ancrage payDay, div/0,
 * échéance dépassée (D1), PAUSED, % sur le confirmé (CA13), D2.
 */

import { describe, expect, it } from 'vitest';
import { BudgetFormulas } from './budget-formulas.js';
import {
  PACE_TOLERANCE_PERCENT,
  calculatePaceStatus,
  computeSavingsGoalProgress,
  suggestedMonthlyContribution,
  type LinkedSavingLine,
  type LinkedSavingTransaction,
  type SavingsGoalProgressInput,
} from './savings-goal-progress.js';

let idCounter = 0;

function savingLine(
  amount: number,
  period: { month: number; year: number },
  options: Partial<LinkedSavingLine> = {},
): LinkedSavingLine {
  return {
    id: `line-${++idCounter}`,
    amount,
    kind: 'saving',
    checkedAt: null,
    ...period,
    ...options,
  };
}

function checkedTx(
  budgetLineId: string,
  amount: number,
  kind: LinkedSavingTransaction['kind'] = 'saving',
): LinkedSavingTransaction {
  return { budgetLineId, amount, kind, checkedAt: '2026-06-15T10:00:00Z' };
}

/** Objectif créé janvier 2026, échéance décembre 2026, "maintenant" = juin 2026. */
function baseInput(
  overrides: Partial<SavingsGoalProgressInput> = {},
): SavingsGoalProgressInput {
  return {
    targetAmount: 12_000,
    status: 'ACTIVE',
    createdAt: '2026-01-10T08:00:00Z',
    targetDate: '2026-12-15',
    now: new Date(2026, 5, 15), // 15 juin 2026
    payDayOfMonth: null,
    lines: [],
    transactions: [],
    ...overrides,
  };
}

describe('BudgetFormulas.calculateRealizedSavings', () => {
  it('filtre kind=saving STRICT — une dépense pointée sur la même ligne ne compte pas (bug #1)', () => {
    const line = savingLine(500, { month: 6, year: 2026 });
    const confirmed = BudgetFormulas.calculateRealizedSavings(
      [line],
      [checkedTx(line.id, 300, 'expense')],
    );
    expect(confirmed).toBe(0);
  });

  it('ignore les lignes non-saving même pointées', () => {
    const expenseLine = {
      ...savingLine(500, { month: 6, year: 2026 }),
      kind: 'expense' as const,
      checkedAt: '2026-06-01T00:00:00Z',
    };
    expect(BudgetFormulas.calculateRealizedSavings([expenseLine], [])).toBe(0);
  });

  it("N'INCLUT PAS les transactions libres (budgetLineId absent) — différence assumée avec calculateRealizedExpenses", () => {
    const freeTx: LinkedSavingTransaction = {
      budgetLineId: null,
      amount: 400,
      kind: 'saving',
      checkedAt: '2026-06-01T00:00:00Z',
    };
    expect(BudgetFormulas.calculateRealizedSavings([], [freeTx])).toBe(0);
    // Contrôle : la formule dépenses, elle, compte cette transaction libre.
    expect(
      BudgetFormulas.calculateRealizedExpenses(
        [],
        [{ ...freeTx, budgetLineId: undefined }],
      ),
    ).toBe(400);
  });

  it('enveloppe max(line, consumed) pour une ligne pointée, consumed seul sinon', () => {
    const checkedLine = savingLine(
      500,
      { month: 5, year: 2026 },
      {
        checkedAt: '2026-05-28T00:00:00Z',
      },
    );
    const uncheckedLine = savingLine(500, { month: 6, year: 2026 });
    const confirmed = BudgetFormulas.calculateRealizedSavings(
      [checkedLine, uncheckedLine],
      [checkedTx(checkedLine.id, 650), checkedTx(uncheckedLine.id, 200)],
    );
    // pointée: max(500, 650) = 650 ; non pointée: 200 consommés pointés
    expect(confirmed).toBe(850);
  });

  it('ignore les transactions allouées non pointées', () => {
    const line = savingLine(500, { month: 6, year: 2026 });
    const uncheckedTx: LinkedSavingTransaction = {
      budgetLineId: line.id,
      amount: 300,
      kind: 'saving',
      checkedAt: null,
    };
    expect(BudgetFormulas.calculateRealizedSavings([line], [uncheckedTx])).toBe(
      0,
    );
  });
});

describe('calculatePaceStatus', () => {
  it('behind sous 95 %, on_track dans ±5 %, ahead au-dessus de 105 %', () => {
    expect(calculatePaceStatus(9_499, 10_000)).toBe('behind');
    expect(calculatePaceStatus(9_500, 10_000)).toBe('on_track');
    expect(calculatePaceStatus(10_000, 10_000)).toBe('on_track');
    expect(calculatePaceStatus(10_500, 10_000)).toBe('on_track');
    expect(calculatePaceStatus(10_501, 10_000)).toBe('ahead');
  });

  it('la tolérance par défaut est 5 %', () => {
    expect(PACE_TOLERANCE_PERCENT).toBe(5);
  });
});

describe('computeSavingsGoalProgress — les deux couches', () => {
  it('plannedCumulative = Σ line.amount BRUT des mois ≤ courant, sans enveloppe (CA1)', () => {
    const january = savingLine(1_000, { month: 1, year: 2026 });
    const june = savingLine(1_000, { month: 6, year: 2026 });
    const july = savingLine(1_000, { month: 7, year: 2026 }); // futur — exclu
    const result = computeSavingsGoalProgress(
      baseInput({
        lines: [january, june, july],
        // Sur-consommation pointée : l'enveloppe donnerait 1500, le prévu reste 1000.
        transactions: [checkedTx(january.id, 1_500)],
      }),
    );
    expect(result.plannedCumulative).toBe(2_000);
  });

  it('confirmed compte TOUS les mois, y compris un pointage anticipé futur (§4.3)', () => {
    const july = savingLine(
      1_000,
      { month: 7, year: 2026 },
      {
        checkedAt: '2026-06-15T00:00:00Z',
      },
    );
    const result = computeSavingsGoalProgress(baseInput({ lines: [july] }));
    expect(result.confirmed).toBe(1_000);
    expect(result.plannedCumulative).toBe(0); // futur — exclu du prévu
  });

  it('exclut les lignes de report virtuelles (isRollover)', () => {
    const rollover = savingLine(
      9_999,
      { month: 6, year: 2026 },
      {
        isRollover: true,
        checkedAt: '2026-06-01T00:00:00Z',
      },
    );
    const result = computeSavingsGoalProgress(baseInput({ lines: [rollover] }));
    expect(result.plannedCumulative).toBe(0);
    expect(result.confirmed).toBe(0);
    expect(result.linkedLineCount).toBe(0);
  });

  it('achievementPercent est sur le CONFIRMÉ, jamais le prévu, plafonné à 100 (CA2, CA13)', () => {
    const planned = savingLine(12_000, { month: 6, year: 2026 });
    const confirmed = savingLine(
      15_000,
      { month: 5, year: 2026 },
      {
        checkedAt: '2026-05-28T00:00:00Z',
      },
    );
    const onlyPlanned = computeSavingsGoalProgress(
      baseInput({ lines: [planned] }),
    );
    expect(onlyPlanned.achievementPercent).toBe(0);

    const overConfirmed = computeSavingsGoalProgress(
      baseInput({ lines: [confirmed] }),
    );
    expect(overConfirmed.achievementPercent).toBe(100);
  });

  it('targetAmount = 0 → achievementPercent 0, paceStatus null — jamais de division (CA2)', () => {
    const line = savingLine(
      500,
      { month: 6, year: 2026 },
      {
        checkedAt: '2026-06-01T00:00:00Z',
      },
    );
    const result = computeSavingsGoalProgress(
      baseInput({ targetAmount: 0, lines: [line] }),
    );
    expect(result.achievementPercent).toBe(0);
    expect(result.paceStatus).toBeNull();
    expect(result.suggestCompletion).toBe(false);
    expect(Number.isFinite(result.required ?? 0)).toBe(true);
  });
});

describe('computeSavingsGoalProgress — rythme et projection (CA3)', () => {
  it('projette le confirmé avec le reliquat prévu du cycle courant à l’échéance, sans double compter le pointé', () => {
    const past = savingLine(1_000, { month: 5, year: 2026 });
    const current = savingLine(500, { month: 6, year: 2026 });
    const future = savingLine(500, { month: 7, year: 2026 });
    const futureChecked = savingLine(
      500,
      { month: 8, year: 2026 },
      { checkedAt: '2026-06-10T00:00:00Z' },
    );
    const afterDeadline = savingLine(900, { month: 1, year: 2027 });

    const result = computeSavingsGoalProgress(
      baseInput({
        targetAmount: 200_000,
        initialAmount: 85_000,
        targetDate: '2026-12-15',
        lines: [past, current, future, futureChecked, afterDeadline],
        transactions: [checkedTx(current.id, 200)],
      }),
    );

    expect(result.confirmed).toBe(85_700);
    expect(result.projected).toBe(86_500);
  });

  it('monthsElapsed inclut le mois courant ; pace = prévu / mois écoulés, confirmedPace = confirmé / mois écoulés', () => {
    const lines = [1, 2, 3, 4, 5, 6].map((month) =>
      savingLine(
        1_000,
        { month, year: 2026 },
        {
          checkedAt: month <= 5 ? '2026-06-01T00:00:00Z' : null,
        },
      ),
    );
    const result = computeSavingsGoalProgress(baseInput({ lines }));
    // janvier → juin = 6 mois écoulés
    expect(result.monthsElapsed).toBe(6);
    expect(result.pace).toBe(1_000); // 6000 prévu / 6
    expect(result.confirmedPace).toBeCloseTo(5_000 / 6, 10);
    // juin → décembre inclus = 7 mois restants
    expect(result.monthsRemaining).toBe(7);
    // required = (12000 − 5000) / 7 = 1000
    expect(result.required).toBe(1_000);
    // Projection = 5000 confirmés + le reliquat prévu du mois courant.
    expect(result.projected).toBe(6_000);
    expect(result.paceStatus).toBe('behind');
  });

  it('required est plancher à 0 quand le confirmé dépasse la cible', () => {
    const line = savingLine(
      20_000,
      { month: 5, year: 2026 },
      {
        checkedAt: '2026-05-01T00:00:00Z',
      },
    );
    const result = computeSavingsGoalProgress(baseInput({ lines: [line] }));
    expect(result.required).toBe(0);
    expect(result.paceStatus).toBe('ahead');
  });
});

describe('computeSavingsGoalProgress — ancrage payDay (piège §4.3)', () => {
  it('un objectif créé le 28 avec payDay 25 appartient au cycle SUIVANT — monthsElapsed reste ≥ 1', () => {
    const result = computeSavingsGoalProgress(
      baseInput({
        createdAt: '2026-06-28T10:00:00Z', // payDay 25 → cycle juillet
        now: new Date(2026, 5, 29), // 29 juin → cycle juillet aussi
        payDayOfMonth: 25,
        targetDate: '2027-06-15',
      }),
    );
    expect(result.monthsElapsed).toBe(1);
    expect(Number.isFinite(result.pace)).toBe(true);
  });

  it("l'échéance est payDay-aware : un target le 28 avec payDay 25 tombe dans le cycle suivant", () => {
    const onPayDayBoundary = computeSavingsGoalProgress(
      baseInput({
        payDayOfMonth: 25,
        now: new Date(2026, 5, 26), // cycle juillet (payDay 2e quinzaine → nommé fin)
        targetDate: '2026-07-28', // cycle août
      }),
    );
    expect(onPayDayBoundary.monthsRemaining).toBeGreaterThanOrEqual(1);
    expect(onPayDayBoundary.isOverdue).toBe(false);
  });
});

describe('computeSavingsGoalProgress — D1 échéance dépassée (CA4)', () => {
  it('monthsRemaining ≤ 0 → required null, projected = confirmed, paceStatus null (pas behind)', () => {
    const line = savingLine(
      3_000,
      { month: 3, year: 2026 },
      {
        checkedAt: '2026-03-28T00:00:00Z',
      },
    );
    const result = computeSavingsGoalProgress(
      baseInput({
        targetDate: '2026-04-10', // dépassée (now = juin)
        lines: [line],
      }),
    );
    expect(result.isOverdue).toBe(true);
    expect(result.monthsRemaining).toBeLessThanOrEqual(0);
    expect(result.required).toBeNull();
    expect(result.projected).toBe(3_000);
    expect(result.paceStatus).toBeNull();
  });

  it("le mois d'échéance lui-même reste contributif : monthsRemaining = 1, pas overdue", () => {
    const result = computeSavingsGoalProgress(
      baseInput({ targetDate: '2026-06-20' }), // même cycle que now
    );
    expect(result.monthsRemaining).toBe(1);
    expect(result.isOverdue).toBe(false);
  });
});

describe('computeSavingsGoalProgress — statuts (D2, PAUSED)', () => {
  it('PAUSED → paceStatus null, pas de jugement de rythme', () => {
    const line = savingLine(100, { month: 6, year: 2026 });
    const result = computeSavingsGoalProgress(
      baseInput({ status: 'PAUSED', lines: [line] }),
    );
    expect(result.paceStatus).toBeNull();
    // Le reste des couches reste calculé (l'UI affiche la barre, sans jugement).
    expect(result.plannedCumulative).toBe(100);
  });

  it('D2 : confirmed ≥ target sur un objectif ACTIVE → suggestCompletion, sans toucher au statut', () => {
    const line = savingLine(
      12_000,
      { month: 5, year: 2026 },
      {
        checkedAt: '2026-05-01T00:00:00Z',
      },
    );
    const result = computeSavingsGoalProgress(baseInput({ lines: [line] }));
    expect(result.suggestCompletion).toBe(true);
    expect(result.achievementPercent).toBe(100);
  });

  it('D2 : pas de suggestion sur le PRÉVU seul (CA13) ni sur un objectif déjà COMPLETED', () => {
    const plannedOnly = savingLine(12_000, { month: 5, year: 2026 });
    expect(
      computeSavingsGoalProgress(baseInput({ lines: [plannedOnly] }))
        .suggestCompletion,
    ).toBe(false);

    const confirmedLine = savingLine(
      12_000,
      { month: 5, year: 2026 },
      {
        checkedAt: '2026-05-01T00:00:00Z',
      },
    );
    expect(
      computeSavingsGoalProgress(
        baseInput({ status: 'COMPLETED', lines: [confirmedLine] }),
      ).suggestCompletion,
    ).toBe(false);
  });

  describe('formule 10 — écart cumulé', () => {
    it('should be planned minus confirmed, signed and never clamped', () => {
      const checked = savingLine(
        1000,
        { month: 2, year: 2026 },
        { checkedAt: '2026-02-01T00:00:00Z' },
      );
      const planned = savingLine(3000, { month: 4, year: 2026 });

      const result = computeSavingsGoalProgress(
        baseInput({ lines: [checked, planned] }),
      );

      expect(result.plannedCumulative).toBe(4000);
      expect(result.confirmed).toBe(1000);
      expect(result.cumulativeGap).toBe(3000);
    });

    it('should be negative on early pointing (ahead of plan)', () => {
      const earlyChecked = savingLine(
        2000,
        { month: 8, year: 2026 },
        { checkedAt: '2026-08-01T00:00:00Z' },
      );

      const result = computeSavingsGoalProgress(
        baseInput({ lines: [earlyChecked] }),
      );

      expect(result.plannedCumulative).toBe(0);
      expect(result.cumulativeGap).toBe(-2000);
    });
  });

  describe("formule 11 — date d'atteinte estimée", () => {
    it('should project the completion period at the confirmed pace', () => {
      const checked = savingLine(
        6000,
        { month: 3, year: 2026 },
        { checkedAt: '2026-03-01T00:00:00Z' },
      );

      const result = computeSavingsGoalProgress(
        baseInput({ lines: [checked] }),
      );

      expect(result.confirmedPace).toBe(1000);
      expect(result.estimatedCompletion).toEqual({ month: 12, year: 2026 });
    });

    it('should be null without any pointing (confirmedPace = 0)', () => {
      const planned = savingLine(3000, { month: 4, year: 2026 });

      const result = computeSavingsGoalProgress(
        baseInput({ lines: [planned] }),
      );

      expect(result.estimatedCompletion).toBeNull();
    });

    it('should return the current period once the target is reached', () => {
      const checked = savingLine(
        12_000,
        { month: 3, year: 2026 },
        { checkedAt: '2026-03-01T00:00:00Z' },
      );

      const result = computeSavingsGoalProgress(
        baseInput({ lines: [checked] }),
      );

      expect(result.estimatedCompletion).toEqual({ month: 6, year: 2026 });
    });

    it('should be null on a PAUSED goal', () => {
      const checked = savingLine(
        6000,
        { month: 3, year: 2026 },
        { checkedAt: '2026-03-01T00:00:00Z' },
      );

      const result = computeSavingsGoalProgress(
        baseInput({ status: 'PAUSED', lines: [checked] }),
      );

      expect(result.estimatedCompletion).toBeNull();
    });
  });
});

describe('computeSavingsGoalProgress — initialAmount (stock vs flux)', () => {
  it('additionne le stock au confirmé/%, l’exclut du rythme et de l’écart cumulé', () => {
    const may = savingLine(
      100,
      { month: 5, year: 2026 },
      { checkedAt: '2026-05-01T00:00:00Z' },
    );
    const june = savingLine(
      100,
      { month: 6, year: 2026 },
      { checkedAt: '2026-06-01T00:00:00Z' },
    );
    const withInitial = computeSavingsGoalProgress(
      baseInput({
        targetAmount: 10_000,
        createdAt: '2026-05-01T08:00:00Z',
        initialAmount: 5_000,
        lines: [may, june],
      }),
    );
    const withoutInitial = computeSavingsGoalProgress(
      baseInput({
        targetAmount: 10_000,
        createdAt: '2026-05-01T08:00:00Z',
        lines: [may, june],
      }),
    );

    expect(withInitial.confirmed).toBe(5_200);
    expect(withInitial.achievementPercent).toBe(52);
    expect(withInitial.confirmedPace).toBe(100);
    expect(withInitial.initialAmount).toBe(5_000);
    // Rythme et écart cumulé sont des mesures de FLUX, inchangées par le stock.
    expect(withInitial.confirmedPace).toBe(withoutInitial.confirmedPace);
    expect(withInitial.cumulativeGap).toBe(withoutInitial.cumulativeGap);
  });

  it('un stock ≥ cible déclenche suggestCompletion dès la création', () => {
    const result = computeSavingsGoalProgress(
      baseInput({
        targetAmount: 5_000,
        createdAt: '2026-06-01T08:00:00Z', // même cycle que "now"
        initialAmount: 6_000,
        lines: [],
      }),
    );
    expect(result.suggestCompletion).toBe(true);
    expect(result.achievementPercent).toBe(100);
  });

  it('garde targetAmount = 0 intacte même avec un stock positif', () => {
    const result = computeSavingsGoalProgress(
      baseInput({ targetAmount: 0, initialAmount: 5_000 }),
    );
    expect(result.achievementPercent).toBe(0);
    expect(result.suggestCompletion).toBe(false);
  });

  it('non-régression : initialAmount absent ET 0 produisent un résultat strictement identique', () => {
    const lines = [1, 2, 3, 4, 5, 6].map((month) =>
      savingLine(
        1_000,
        { month, year: 2026 },
        { checkedAt: month <= 5 ? '2026-06-01T00:00:00Z' : null },
      ),
    );
    const absent = computeSavingsGoalProgress(baseInput({ lines }));
    const zero = computeSavingsGoalProgress(
      baseInput({ lines, initialAmount: 0 }),
    );

    expect(absent.initialAmount).toBe(0);
    expect(zero).toEqual(absent);
  });
});

describe('suggestedMonthlyContribution (PUL-285 CA1/CA6)', () => {
  it('uses a future contribution start instead of the current month (PUL-314 CA13)', () => {
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 1_400,
      startDate: '2027-06-15',
      targetDate: '2027-12-15',
      now: new Date(2026, 6, 15),
      payDayOfMonth: null,
    });

    expect(suggestion).toBe(200);
  });

  it('should divide the target across the remaining months, current and deadline months inclusive', () => {
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 100_000,
      targetDate: '2030-05-15',
      now: new Date(2026, 5, 15), // juin 2026 → mai 2030 = 48 mois
      payDayOfMonth: null,
    });

    expect(suggestion).toBe(2083.34);
  });

  it('should not overshoot when the exact quotient already lands on a cent (float artifact)', () => {
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 1000.1,
      targetDate: '2026-07-15', // juillet 2026 → 2 mois restants depuis juin
      now: new Date(2026, 5, 15),
      payDayOfMonth: null,
    });

    expect(suggestion).toBe(500.05);
  });

  it('should round UP to the cent so suggestion × months always covers the target', () => {
    const monthCount = 48;
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 100_000,
      targetDate: '2030-05-15',
      now: new Date(2026, 5, 15),
      payDayOfMonth: null,
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion! * monthCount).toBeGreaterThanOrEqual(100_000);
  });

  it('should match the required formula base — same month indexing as formula 5 with confirmed = 0', () => {
    const now = new Date(2026, 5, 15);
    const progress = computeSavingsGoalProgress(
      baseInput({ targetAmount: 12_000, targetDate: '2026-12-15', now }),
    );
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 12_000,
      targetDate: '2026-12-15',
      now,
      payDayOfMonth: null,
    });

    expect(progress.required).not.toBeNull();
    expect(suggestion).toBe(Math.ceil(progress.required! * 100) / 100);
  });

  it('should be payDay-aware — a payDay before today shifts the current period forward', () => {
    const withoutPayDay = suggestedMonthlyContribution({
      targetAmount: 1200,
      targetDate: '2026-12-15',
      now: new Date(2026, 5, 28), // 28 juin, payDay 25 → cycle de juillet
      payDayOfMonth: null,
    });
    const withPayDay = suggestedMonthlyContribution({
      targetAmount: 1200,
      targetDate: '2026-12-15',
      now: new Date(2026, 5, 28),
      payDayOfMonth: 25,
    });

    expect(withoutPayDay).not.toEqual(withPayDay);
  });

  it('should return null when the deadline is already past', () => {
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 5000,
      targetDate: '2026-01-15',
      now: new Date(2026, 5, 15),
      payDayOfMonth: null,
    });

    expect(suggestion).toBeNull();
  });

  it('should only decompose what is left to save once an initial amount covers part of the target (PUL-293)', () => {
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 10_000,
      initialAmount: 5000,
      targetDate: '2026-12-15', // juin → décembre 2026 = 7 mois
      now: new Date(2026, 5, 15),
      payDayOfMonth: null,
    });

    // 5 000 restants ÷ 7, pas 10 000 ÷ 7 : décomposer la cible entière
    // sur-provisionnerait la prévision récurrente générée.
    expect(suggestion).toBe(714.29);
  });

  it('should stay identical when the initial amount is absent or zero (PUL-293 non-regression)', () => {
    const args = {
      targetAmount: 10_000,
      targetDate: '2026-12-15',
      now: new Date(2026, 5, 15),
      payDayOfMonth: null,
    };

    expect(suggestedMonthlyContribution({ ...args, initialAmount: 0 })).toBe(
      suggestedMonthlyContribution(args),
    );
  });

  it('should return null when the initial amount already covers the target — nothing to decompose (PUL-293)', () => {
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 10_000,
      initialAmount: 10_000,
      targetDate: '2026-12-15',
      now: new Date(2026, 5, 15),
      payDayOfMonth: null,
    });

    expect(suggestion).toBeNull();
  });

  it('should keep matching the required formula once the initial amount feeds the confirmed (PUL-293)', () => {
    const now = new Date(2026, 5, 15);
    // À la création, le confirmé de la formule 5 se réduit au montant de départ.
    const progress = computeSavingsGoalProgress(
      baseInput({
        targetAmount: 12_000,
        initialAmount: 3000,
        targetDate: '2026-12-15',
        now,
      }),
    );
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 12_000,
      initialAmount: 3000,
      targetDate: '2026-12-15',
      now,
      payDayOfMonth: null,
    });

    expect(progress.required).not.toBeNull();
    expect(suggestion).toBe(Math.ceil(progress.required! * 100) / 100);
  });

  it('should return null on a non-positive target', () => {
    const suggestion = suggestedMonthlyContribution({
      targetAmount: 0,
      targetDate: '2026-12-15',
      now: new Date(2026, 5, 15),
      payDayOfMonth: null,
    });

    expect(suggestion).toBeNull();
  });
});

describe('PUL-314 — open savings interval', () => {
  it('keeps history from createdAt when startDate is absent', () => {
    const historical = savingLine(400, { month: 2, year: 2026 });
    const result = computeSavingsGoalProgress(
      baseInput({
        lines: [
          {
            ...historical,
            checkedAt: '2026-02-15T10:00:00Z',
          },
        ],
      }),
    );

    expect(result.plannedCumulative).toBe(400);
    expect(result.confirmed).toBe(400);
    expect(result.monthsElapsed).toBe(6);
  });

  it('returns no fictitious target or deadline metrics when both are absent', () => {
    const current = savingLine(200, { month: 6, year: 2026 });
    const future = savingLine(300, { month: 7, year: 2026 });
    const result = computeSavingsGoalProgress(
      baseInput({
        targetAmount: null,
        targetDate: null,
        initialAmount: 100,
        lines: [current, future],
      }),
    );

    expect(result).toMatchObject({
      achievementPercent: null,
      monthsRemaining: null,
      isOverdue: false,
      required: null,
      projected: null,
      paceStatus: null,
      suggestCompletion: null,
      plannedCumulative: 200,
      plannedProjection: 600,
    });
  });

  it('keeps estimated completion with a target but no deadline', () => {
    const current = savingLine(1000, { month: 6, year: 2026 });
    const result = computeSavingsGoalProgress(
      baseInput({
        targetAmount: 3000,
        targetDate: null,
        lines: [
          {
            ...current,
            checkedAt: '2026-06-15T10:00:00Z',
          },
        ],
      }),
    );

    expect(result.monthsRemaining).toBeNull();
    expect(result.required).toBeNull();
    expect(result.projected).toBeNull();
    expect(result.paceStatus).toBeNull();
    expect(result.estimatedCompletion).toEqual({ month: 6, year: 2027 });
  });

  it('excludes linked lines before the effective start from aggregates', () => {
    const before = savingLine(1000, { month: 6, year: 2026 });
    const atStart = savingLine(500, { month: 7, year: 2026 });
    const result = computeSavingsGoalProgress(
      baseInput({
        startDate: '2026-07-15',
        targetDate: '2026-08-15',
        lines: [before, atStart],
      }),
    );

    expect(result.plannedCumulative).toBe(0);
    expect(result.plannedProjection).toBe(500);
  });
});

describe('computeSavingsGoalProgress withdrawals (PUL-329)', () => {
  const CONFIRMED_LINE_AMOUNT = 10_000;
  const WITHDRAWAL_AMOUNT = 4_500;

  /** 10'000 CHF confirmés en juin, plus 2'000 CHF encore planifiés en juillet. */
  function inputWithConfirmedStock(
    overrides: Partial<SavingsGoalProgressInput> = {},
  ): SavingsGoalProgressInput {
    const confirmedLine = savingLine(
      CONFIRMED_LINE_AMOUNT,
      { month: 6, year: 2026 },
      { checkedAt: '2026-06-15T10:00:00Z' },
    );
    const futureLine = savingLine(2_000, { month: 7, year: 2026 });

    return baseInput({
      lines: [confirmedLine, futureLine],
      ...overrides,
    });
  }

  it('should subtract withdrawals from the confirmed stock', () => {
    const result = computeSavingsGoalProgress(
      inputWithConfirmedStock({
        withdrawals: [{ amount: WITHDRAWAL_AMOUNT, month: 6, year: 2026 }],
      }),
    );

    expect(result.confirmed).toBe(5_500);
    expect(result.withdrawn).toBe(WITHDRAWAL_AMOUNT);
  });

  it('should lower the projection by exactly the withdrawn amount', () => {
    const withoutWithdrawal = computeSavingsGoalProgress(
      inputWithConfirmedStock(),
    );
    const withWithdrawal = computeSavingsGoalProgress(
      inputWithConfirmedStock({
        withdrawals: [{ amount: WITHDRAWAL_AMOUNT, month: 6, year: 2026 }],
      }),
    );

    expect(withoutWithdrawal.projected).toBe(12_000);
    expect(withWithdrawal.projected).toBe(12_000 - WITHDRAWAL_AMOUNT);
  });

  it('should keep the confirmed pace identical before and after a withdrawal', () => {
    const withoutWithdrawal = computeSavingsGoalProgress(
      inputWithConfirmedStock(),
    );
    const withWithdrawal = computeSavingsGoalProgress(
      inputWithConfirmedStock({
        withdrawals: [{ amount: WITHDRAWAL_AMOUNT, month: 6, year: 2026 }],
      }),
    );

    expect(withWithdrawal.confirmedPace).toBe(withoutWithdrawal.confirmedPace);
    expect(withWithdrawal.pace).toBe(withoutWithdrawal.pace);
  });

  it('should leave the future plan untouched by a withdrawal', () => {
    const withoutWithdrawal = computeSavingsGoalProgress(
      inputWithConfirmedStock(),
    );
    const withWithdrawal = computeSavingsGoalProgress(
      inputWithConfirmedStock({
        withdrawals: [{ amount: WITHDRAWAL_AMOUNT, month: 6, year: 2026 }],
      }),
    );

    expect(withWithdrawal.plannedCumulative).toBe(
      withoutWithdrawal.plannedCumulative,
    );
    expect(withWithdrawal.plannedProjection).toBe(
      withoutWithdrawal.plannedProjection,
    );
    expect(withWithdrawal.linkedLineCount).toBe(
      withoutWithdrawal.linkedLineCount,
    );
  });

  it('should floor the achievement percent at zero when the stock went negative', () => {
    // Un retrait puis le dépointage de la ligne qui le finançait : l'écriture
    // interdit le découvert, mais rien n'interdit de défaire la contribution
    // après coup. `confirmed` doit rester signé pour le diagnostic, alors que
    // `achievementPercent` est contraint à [0, 100] par le contrat partagé —
    // un pourcentage négatif ferait échouer le parse de TOUTE la progression
    // côté client web.
    const result = computeSavingsGoalProgress(
      baseInput({
        withdrawals: [{ amount: WITHDRAWAL_AMOUNT, month: 6, year: 2026 }],
      }),
    );

    expect(result.confirmed).toBe(-WITHDRAWAL_AMOUNT);
    expect(result.achievementPercent).toBe(0);
  });

  it('should not count a withdrawal as a negative contribution in the cumulative gap', () => {
    const withWithdrawal = computeSavingsGoalProgress(
      inputWithConfirmedStock({
        withdrawals: [{ amount: WITHDRAWAL_AMOUNT, month: 6, year: 2026 }],
      }),
    );

    expect(withWithdrawal.cumulativeGap).toBe(
      CONFIRMED_LINE_AMOUNT - (CONFIRMED_LINE_AMOUNT - WITHDRAWAL_AMOUNT),
    );
  });

  it('should ignore a future-dated withdrawal in the cumulative gap while still subtracting it from the stock', () => {
    const result = computeSavingsGoalProgress(
      inputWithConfirmedStock({
        withdrawals: [{ amount: WITHDRAWAL_AMOUNT, month: 8, year: 2026 }],
      }),
    );

    expect(result.confirmed).toBe(5_500);
    expect(result.cumulativeGap).toBe(0);
  });

  it('should place a withdrawal in the pay-day cycle rather than the calendar month', () => {
    const julyWithdrawal = baseInput({
      initialAmount: CONFIRMED_LINE_AMOUNT,
      withdrawals: [{ amount: WITHDRAWAL_AMOUNT, month: 7, year: 2026 }],
    });

    const afterPayDay = computeSavingsGoalProgress({
      ...julyWithdrawal,
      payDayOfMonth: 25,
      now: new Date(2026, 5, 26),
    });
    const beforePayDay = computeSavingsGoalProgress({
      ...julyWithdrawal,
      payDayOfMonth: 25,
      now: new Date(2026, 5, 24),
    });
    const calendarMonth = computeSavingsGoalProgress({
      ...julyWithdrawal,
      payDayOfMonth: null,
      now: new Date(2026, 5, 26),
    });

    expect(afterPayDay.cumulativeGap).toBe(WITHDRAWAL_AMOUNT);
    expect(beforePayDay.cumulativeGap).toBe(0);
    expect(calendarMonth.cumulativeGap).toBe(0);
    expect(afterPayDay.confirmed).toBe(5_500);
    expect(beforePayDay.confirmed).toBe(5_500);
  });

  it('should keep a negative stock visible instead of clamping it to zero', () => {
    const result = computeSavingsGoalProgress(
      inputWithConfirmedStock({
        withdrawals: [
          { amount: CONFIRMED_LINE_AMOUNT + 1, month: 6, year: 2026 },
        ],
      }),
    );

    expect(result.confirmed).toBe(-1);
  });

  it('should keep the goal reachable again once the withdrawal is removed', () => {
    const withWithdrawal = computeSavingsGoalProgress(
      inputWithConfirmedStock({
        withdrawals: [{ amount: WITHDRAWAL_AMOUNT, month: 6, year: 2026 }],
      }),
    );
    const afterDeletion = computeSavingsGoalProgress(
      inputWithConfirmedStock({ withdrawals: [] }),
    );

    expect(withWithdrawal.achievementPercent).toBe(46);
    expect(afterDeletion.achievementPercent).toBe(83);
  });
});
