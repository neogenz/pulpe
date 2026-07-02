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
    // projected = 5000 + (5000/6)*7 — base CONFIRMÉE, cohérente avec la barre
    expect(result.projected).toBeCloseTo(5_000 + (5_000 / 6) * 7, 10);
    expect(result.paceStatus).toBe('behind'); // ≈10833 < 11400 (95 %)
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
});
