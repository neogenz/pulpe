/**
 * @fileoverview SAVINGS GOAL PROGRESS - Les 9 formules de progression (PUL-8)
 *
 * Source de vérité métier : docs/SAVINGS.md §4. Fonctions pures, payDay-aware
 * via `getBudgetPeriodForDate`. Le backend fournit des montants DÉCHIFFRÉS ;
 * aucune formule ne divise par une cible potentiellement non déchiffrée
 * (garde `targetAmount ≤ 0`).
 *
 * NOTE: L'import utilise l'extension .js (pas .ts) - exigence ESM Node.js.
 */

import type {
  SavingsGoalPaceStatus,
  SavingsGoalStatus,
  TransactionKind,
} from '../../schemas.js';
import { BudgetFormulas } from './budget-formulas.js';
import { getBudgetPeriodForDate } from './budget-period.js';

/** Tolérance ±5 % du statut de rythme (docs/SAVINGS.md §4.2, formule 7). */
export const PACE_TOLERANCE_PERCENT = 5;

/**
 * Prévision Épargne liée à l'objectif, avec la période budgétaire (month/year)
 * du budget qui la porte. `isRollover` est une garde défensive pour les
 * consommateurs client qui injectent des lignes de report virtuelles — côté
 * DB la colonne n'existe pas.
 */
export interface LinkedSavingLine {
  id: string;
  amount: number;
  kind: TransactionKind;
  checkedAt?: string | null;
  isRollover?: boolean;
  month: number;
  year: number;
}

/** Transaction allouée à une des prévisions liées. */
export interface LinkedSavingTransaction {
  budgetLineId?: string | null;
  amount: number;
  kind: TransactionKind;
  checkedAt?: string | null;
}

export interface SavingsGoalProgressInput {
  targetAmount: number;
  status: SavingsGoalStatus;
  /** ISO datetime — ancrage ramené à son cycle payDay-aware. */
  createdAt: string;
  /** ISO date `YYYY-MM-DD`. */
  targetDate: string;
  payDayOfMonth?: number | null;
  /** Injectable pour les tests ; défaut = maintenant. */
  now?: Date;
  lines: LinkedSavingLine[];
  transactions: LinkedSavingTransaction[];
}

export interface SavingsGoalProgressResult {
  plannedCumulative: number;
  confirmed: number;
  achievementPercent: number;
  monthsElapsed: number;
  monthsRemaining: number;
  isOverdue: boolean;
  pace: number;
  confirmedPace: number;
  required: number | null;
  projected: number;
  paceStatus: SavingsGoalPaceStatus | null;
  suggestCompletion: boolean;
  linkedLineCount: number;
}

/**
 * Statut de rythme : `projected` vs `targetAmount`, tolérance ±5 %.
 * Les cas `null` (PAUSED, échéance dépassée, cible nulle) sont gérés par
 * `computeSavingsGoalProgress` — cette fonction suppose une cible > 0.
 */
export function calculatePaceStatus(
  projected: number,
  targetAmount: number,
  tolerancePercent: number = PACE_TOLERANCE_PERCENT,
): SavingsGoalPaceStatus {
  const tolerance = tolerancePercent / 100;
  const ratio = projected / targetAmount;
  if (ratio < 1 - tolerance) return 'behind';
  if (ratio > 1 + tolerance) return 'ahead';
  return 'on_track';
}

/**
 * Parse une date ISO nue `YYYY-MM-DD` en Date LOCALE — `new Date('YYYY-MM-DD')`
 * serait minuit UTC et pourrait glisser d'un jour (donc d'un cycle payDay).
 */
function parseIsoDateLocal(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Index de période comparable : `year * 12 + month`. */
function periodIndex(period: { month: number; year: number }): number {
  return period.year * 12 + period.month;
}

export function computeSavingsGoalProgress(
  input: SavingsGoalProgressInput,
): SavingsGoalProgressResult {
  const now = input.now ?? new Date();
  const payDay = input.payDayOfMonth;

  const indexAnchor = periodIndex(
    getBudgetPeriodForDate(new Date(input.createdAt), payDay),
  );
  const indexCurrent = periodIndex(getBudgetPeriodForDate(now, payDay));
  const indexTarget = periodIndex(
    getBudgetPeriodForDate(parseIsoDateLocal(input.targetDate), payDay),
  );

  // ≥ 1 par construction — la garde couvre le cas createdAt rattaché au cycle
  // SUIVANT (créé le 28 avec payDay 25 ⇒ indexAnchor = indexCurrent + 1).
  const monthsElapsed = Math.max(1, indexCurrent - indexAnchor + 1);
  // Mois courant ET mois d'échéance inclus (le mois courant reste contributif).
  const monthsRemaining = indexTarget - indexCurrent + 1;
  const isOverdue = monthsRemaining <= 0;

  // Double garde kind=saving (le lien est déjà kind-guardé à l'écriture) +
  // exclusion des lignes de report virtuelles côté client.
  const savingLines = input.lines.filter(
    (line) => line.kind === 'saving' && line.isRollover !== true,
  );

  // 1. Prévu cumulé — pur line.amount des mois ≤ courant, PAS d'enveloppe.
  const plannedCumulative = savingLines
    .filter((line) => periodIndex(line) <= indexCurrent)
    .reduce((sum, line) => sum + line.amount, 0);

  // 2. Confirmé — enveloppe checked-only, TOUS mois (pointage anticipé compte).
  const confirmed = BudgetFormulas.calculateRealizedSavings(
    savingLines,
    input.transactions,
  );

  // 3. % d'atteinte — sur le CONFIRMÉ ; cible nulle/non déchiffrée ⇒ 0.
  const achievementPercent =
    input.targetAmount > 0
      ? Math.round(Math.min(confirmed / input.targetAmount, 1) * 100)
      : 0;

  // 4. Deux rythmes — la projection se base sur le rythme CONFIRMÉ.
  const pace = plannedCumulative / monthsElapsed;
  const confirmedPace = confirmed / monthsElapsed;

  // 5-6. Requis / projection — neutralisés quand l'échéance est dépassée (D1).
  const required = isOverdue
    ? null
    : Math.max(0, input.targetAmount - confirmed) / monthsRemaining;
  const projected = isOverdue
    ? confirmed
    : confirmed + confirmedPace * monthsRemaining;

  // 7. Statut de rythme — PAUSED et échéance dépassée n'ont PAS de jugement.
  const paceStatus =
    input.status === 'PAUSED' || isOverdue || input.targetAmount <= 0
      ? null
      : calculatePaceStatus(projected, input.targetAmount);

  // D2 — suggérer « marquer terminé ? » sur le confirmé, jamais d'auto-flip.
  const suggestCompletion =
    input.status === 'ACTIVE' &&
    input.targetAmount > 0 &&
    confirmed >= input.targetAmount;

  return {
    plannedCumulative,
    confirmed,
    achievementPercent,
    monthsElapsed,
    monthsRemaining,
    isOverdue,
    pace,
    confirmedPace,
    required,
    projected,
    paceStatus,
    suggestCompletion,
    linkedLineCount: savingLines.length,
  };
}
