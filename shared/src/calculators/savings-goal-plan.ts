/**
 * @fileoverview SAVINGS GOAL PLAN — timeline mensuelle + simulation client (PUL-12+).
 *
 * Source de vérité métier : docs/SAVINGS_PLAN.md §5. Fonctions PURES, payDay-aware.
 *
 * `buildSavingsGoalTimeline` est utilisée par le SERVEUR (pour `/progress.months[]`)
 * ET par les clients (pour rebaser le sandbox de simulation). Les trois autres
 * fonctions alimentent le simulateur client (< 400 ms, aucun I/O) et sont
 * mirroir-ées en Swift (`ios/.../Domain/Formulas/SavingsPlanCalculator.swift`).
 *
 * Rupture assumée de la doctrine « le client n'implémente AUCUNE formule » : le
 * serveur reste autoritaire à l'écriture (il recalcule la progression après apply) ;
 * la parité est garantie par un calculateur unique testé + un miroir Swift testé
 * (même mitigation que PUL-17 / spread).
 *
 * NOTE: imports en `.js` — exigence ESM Node.js.
 */

import { BudgetFormulas } from './budget-formulas.js';
import {
  getBudgetPeriodForDate,
  parseIsoDateLocal,
  periodFromIndex,
  periodIndex,
  type BudgetPeriod,
} from './budget-period.js';
import type {
  SavingsGoalProgressInput,
  LinkedSavingLine,
  LinkedSavingTransaction,
} from './savings-goal-progress.js';
import { splitTotalPreserving } from './spread-split.js';

/** État temporel/structurel d'un mois du plan (docs/SAVINGS_PLAN.md §2 pilier B). */
export type SavingsPlanMonthState = 'past' | 'current' | 'future' | 'gap';

export interface SavingsPlanLine {
  budgetLineId: string;
  amount: number;
  checkedAt: string | null;
  isManuallyAdjusted: boolean;
}

export interface SavingsPlanTimelineMonth {
  month: number;
  year: number;
  state: SavingsPlanMonthState;
  /** Non éditable : cycle passé OU toutes les lignes du mois pointées. */
  isLocked: boolean;
  /** Σ line.amount des lignes épargne liées, ce mois. */
  plannedAmount: number;
  /** Enveloppe checked-only (`calculateRealizedSavings`) pour ce mois. */
  confirmedAmount: number;
  plannedCumulative: number;
  confirmedCumulative: number;
  lines: SavingsPlanLine[];
}

const CENTS_PER_UNIT = 100;

function toBudgetFormulaLine(line: LinkedSavingLine) {
  return {
    id: line.id,
    amount: line.amount,
    kind: line.kind,
    checkedAt: line.checkedAt ?? null,
  };
}

/**
 * Un mois est éditable dans le simulateur s'il porte au moins une ligne
 * non pointée et n'est pas verrouillé (cycle passé / tout pointé).
 */
export function isOpenPlanMonth(month: SavingsPlanTimelineMonth): boolean {
  return !month.isLocked && month.lines.some((line) => line.checkedAt == null);
}

/**
 * Construit la timeline mensuelle ancrage → cible (inclus), en garantissant que
 * l'ancrage, le mois courant, la cible ET chaque ligne liée possèdent une row.
 * Les mois sans ligne liée sont `gap` (le mois courant garde `current` pour le
 * badge, même sans ligne). Les cumulatifs à `indexCourant` égalent
 * `plannedCumulative` (mois ≤ courant) et le total confirmé de `computeSavingsGoalProgress`.
 */
export function buildSavingsGoalTimeline(
  input: SavingsGoalProgressInput,
): SavingsPlanTimelineMonth[] {
  const now = input.now ?? new Date();
  const payDay = input.payDayOfMonth;

  const indexAnchor = periodIndex(
    getBudgetPeriodForDate(new Date(input.createdAt), payDay),
  );
  const indexCurrent = periodIndex(getBudgetPeriodForDate(now, payDay));
  const indexTarget = periodIndex(
    getBudgetPeriodForDate(parseIsoDateLocal(input.targetDate), payDay),
  );

  const savingLines = input.lines.filter(
    (line) => line.kind === 'saving' && line.isRollover !== true,
  );

  const lineIndices = savingLines.map((line) => periodIndex(line));
  const startIndex = Math.min(indexAnchor, indexCurrent, ...lineIndices);
  const endIndex = Math.max(indexTarget, indexCurrent, ...lineIndices);

  const months: SavingsPlanTimelineMonth[] = [];
  let plannedCumulative = 0;
  let confirmedCumulative = 0;

  for (let index = startIndex; index <= endIndex; index++) {
    const period = periodFromIndex(index);
    const monthLines = savingLines.filter(
      (line) => periodIndex(line) === index,
    );

    const plannedAmount = monthLines.reduce(
      (sum, line) => sum + line.amount,
      0,
    );
    const confirmedAmount = BudgetFormulas.calculateRealizedSavings(
      monthLines.map(toBudgetFormulaLine),
      input.transactions,
    );

    plannedCumulative += plannedAmount;
    confirmedCumulative += confirmedAmount;

    const hasLines = monthLines.length > 0;
    const allChecked =
      hasLines && monthLines.every((line) => line.checkedAt != null);
    const isLocked = index < indexCurrent || allChecked;

    let state: SavingsPlanMonthState;
    if (index === indexCurrent) state = 'current';
    else if (!hasLines) state = 'gap';
    else if (index < indexCurrent) state = 'past';
    else state = 'future';

    months.push({
      month: period.month,
      year: period.year,
      state,
      isLocked,
      plannedAmount,
      confirmedAmount,
      plannedCumulative,
      confirmedCumulative,
      lines: monthLines.map((line) => ({
        budgetLineId: line.id,
        amount: line.amount,
        checkedAt: line.checkedAt ?? null,
        isManuallyAdjusted: line.isManuallyAdjusted ?? false,
      })),
    });
  }

  return months;
}

export interface SavingsPlanAdjustment {
  month: number;
  year: number;
  amount: number;
}

export interface SavingsPlanSimulatedMonth extends SavingsPlanTimelineMonth {
  simulatedAmount: number;
  simulatedCumulative: number;
  isAdjusted: boolean;
}

export interface SavingsPlanSimulationResult {
  months: SavingsPlanSimulatedMonth[];
  /** Cumulé final : réalité (mois verrouillés) + plan simulé (mois ouverts). */
  simulatedFinal: number;
  /** `targetAmount − simulatedFinal` — signé, jamais clampé. */
  gapToTarget: number;
  isTargetMet: boolean;
  /** Premier mois où le cumulé simulé atteint la cible (verdict « atteint en … »). */
  attainedPeriod: BudgetPeriod | null;
}

function adjustmentKey(item: { month: number; year: number }): number {
  return item.year * 12 + item.month;
}

/**
 * Simule le plan : chaque mois verrouillé garde sa réalité (`confirmedAmount`),
 * chaque mois ouvert prend `adjustment ?? globalMonthlyAmount ?? plannedAmount`.
 * Cibler un mois verrouillé ou gap via `adjustments` lève une erreur (révèle un
 * bug d'UI en développement — même doctrine que `splitTotalPreserving`).
 */
export function simulateSavingsPlan(input: {
  timeline: SavingsPlanTimelineMonth[];
  targetAmount: number;
  adjustments?: SavingsPlanAdjustment[];
  globalMonthlyAmount?: number;
}): SavingsPlanSimulationResult {
  const adjustmentsByKey = new Map<number, number>();
  for (const adjustment of input.adjustments ?? []) {
    adjustmentsByKey.set(adjustmentKey(adjustment), adjustment.amount);
  }

  const openKeys = new Set(
    input.timeline
      .filter((month) => isOpenPlanMonth(month))
      .map((month) => adjustmentKey(month)),
  );
  for (const key of adjustmentsByKey.keys()) {
    if (!openKeys.has(key)) {
      throw new Error(
        'simulateSavingsPlan: adjustment targets a locked or gap month',
      );
    }
  }

  const months: SavingsPlanSimulatedMonth[] = [];
  let simulatedCumulative = 0;
  let attainedPeriod: BudgetPeriod | null = null;

  for (const month of input.timeline) {
    const key = adjustmentKey(month);
    const isOpen = isOpenPlanMonth(month);

    let simulatedAmount: number;
    let isAdjusted = false;
    if (!isOpen) {
      simulatedAmount = month.confirmedAmount;
    } else if (adjustmentsByKey.has(key)) {
      simulatedAmount = adjustmentsByKey.get(key)!;
      isAdjusted = true;
    } else if (input.globalMonthlyAmount != null) {
      simulatedAmount = input.globalMonthlyAmount;
      isAdjusted = simulatedAmount !== month.plannedAmount;
    } else {
      simulatedAmount = month.plannedAmount;
    }

    simulatedCumulative += simulatedAmount;
    if (
      attainedPeriod == null &&
      input.targetAmount > 0 &&
      simulatedCumulative >= input.targetAmount
    ) {
      attainedPeriod = { month: month.month, year: month.year };
    }

    months.push({
      ...month,
      simulatedAmount,
      simulatedCumulative,
      isAdjusted,
    });
  }

  const simulatedFinal = simulatedCumulative;
  return {
    months,
    simulatedFinal,
    gapToTarget: input.targetAmount - simulatedFinal,
    isTargetMet: input.targetAmount > 0 && simulatedFinal >= input.targetAmount,
    attainedPeriod,
  };
}

export interface RedistributeRemainingEffortResult {
  adjustments: SavingsPlanAdjustment[];
  remainingEffort: number;
  perRemainingMonth: number;
  isDistributable: boolean;
}

/**
 * « Réajuster la suite » — répartit l'effort restant sur les mois ouverts non
 * épinglés, cents-exact via `splitTotalPreserving`. Généralisation de PUL-290
 * (`remainingToProvision`/`perRemainingMonth`).
 *
 * `remaining = max(0, target − Σ confirmé(mois verrouillés) − Σ épinglés ouverts)`.
 * `isDistributable = false` quand aucun mois ouvert non épinglé (ex. overdue).
 */
export function redistributeRemainingEffort(input: {
  timeline: SavingsPlanTimelineMonth[];
  targetAmount: number;
  pinnedAdjustments?: SavingsPlanAdjustment[];
}): RedistributeRemainingEffortResult {
  const pinnedByKey = new Map<number, number>();
  for (const pin of input.pinnedAdjustments ?? []) {
    pinnedByKey.set(adjustmentKey(pin), pin.amount);
  }

  const openMonths = input.timeline.filter((month) => isOpenPlanMonth(month));
  const openUnpinned = openMonths.filter(
    (month) => !pinnedByKey.has(adjustmentKey(month)),
  );

  const lockedConfirmedSum = input.timeline
    .filter((month) => !isOpenPlanMonth(month))
    .reduce((sum, month) => sum + month.confirmedAmount, 0);

  const pinnedSum = openMonths
    .filter((month) => pinnedByKey.has(adjustmentKey(month)))
    .reduce((sum, month) => sum + pinnedByKey.get(adjustmentKey(month))!, 0);

  const remaining = Math.max(
    0,
    input.targetAmount - lockedConfirmedSum - pinnedSum,
  );

  if (openUnpinned.length === 0) {
    return {
      adjustments: [],
      remainingEffort: remaining,
      perRemainingMonth: 0,
      isDistributable: false,
    };
  }

  const shares =
    remaining === 0
      ? new Array<number>(openUnpinned.length).fill(0)
      : splitTotalPreserving(remaining, openUnpinned.length);

  const adjustments = openUnpinned.map((month, index) => ({
    month: month.month,
    year: month.year,
    amount: shares[index],
  }));

  return {
    adjustments,
    remainingEffort: remaining,
    perRemainingMonth: shares[0],
    isDistributable: true,
  };
}

export interface AllocatableLine {
  budgetLineId: string;
  amount: number;
  checkedAt: string | null;
}

/**
 * Répartit un montant mensuel total sur les lignes NON pointées d'un mois,
 * cents-exact (plus-grand-reste), proportionnel aux montants actuels. Σ actuelle
 * nulle → split égal. Montant ≤ 0 → toutes les lignes ouvertes à 0.
 * Les lignes pointées sont intouchées (absentes du retour).
 */
export function allocateMonthAmountToLines(
  lines: AllocatableLine[],
  newMonthAmount: number,
): { budgetLineId: string; amount: number }[] {
  const openLines = lines.filter((line) => line.checkedAt == null);
  if (openLines.length === 0) return [];

  if (newMonthAmount <= 0) {
    return openLines.map((line) => ({
      budgetLineId: line.budgetLineId,
      amount: 0,
    }));
  }

  const currentSum = openLines.reduce((sum, line) => sum + line.amount, 0);
  if (currentSum <= 0) {
    const shares = splitTotalPreserving(newMonthAmount, openLines.length);
    return openLines.map((line, index) => ({
      budgetLineId: line.budgetLineId,
      amount: shares[index],
    }));
  }

  const totalCents = Math.round(newMonthAmount * CENTS_PER_UNIT);
  const raw = openLines.map((line) => (line.amount / currentSum) * totalCents);
  const floors = raw.map((value) => Math.floor(value));
  let remainderCents = totalCents - floors.reduce((sum, v) => sum + v, 0);

  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  const cents = [...floors];
  for (const { index } of order) {
    if (remainderCents <= 0) break;
    cents[index] += 1;
    remainderCents -= 1;
  }

  return openLines.map((line, index) => ({
    budgetLineId: line.budgetLineId,
    amount: cents[index] / CENTS_PER_UNIT,
  }));
}

export type { LinkedSavingLine, LinkedSavingTransaction };
