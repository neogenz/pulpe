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
import {
  getBudgetPeriodForDate,
  parseIsoDateLocal,
  periodFromIndex,
  periodIndex,
  type BudgetPeriod,
} from './budget-period.js';

/** Tolérance ±5 % du statut de rythme (docs/SAVINGS.md §4.2, formule 7). */
export const PACE_TOLERANCE_PERCENT = 5;

/**
 * Plafond de l'horizon de la date d'atteinte estimée (formule 11). Au-delà, un
 * rythme confirmé quasi nul projetterait une date absurde (« an 2200 ») ⇒ null.
 */
export const MAX_ESTIMATED_HORIZON_MONTHS = 600;

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
  /**
   * Ligne ajustée manuellement (protégée de la propagation template, RG-001).
   * Optionnel — défaut `false` ; alimenté par le select repo pour la timeline.
   */
  isManuallyAdjusted?: boolean;
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
  /** Périodes portant déjà un budget, même sans ligne liée à cet objectif. */
  materializedPeriods?: BudgetPeriod[];
  /** Le Mois Type actif peut créer une ligne Épargne liée à cet objectif. */
  canProvisionMissingPeriods?: boolean;
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
  /** Formule 10 — écart cumulé `plannedCumulative − confirmed` (signé, jamais clampé). */
  cumulativeGap: number;
  /** Formule 11 — date d'atteinte au rythme confirmé, `null` si non projetable. */
  estimatedCompletion: BudgetPeriod | null;
}

/**
 * Date d'atteinte estimée au rythme CONFIRMÉ (docs/SAVINGS.md §10.2).
 * `null` si PAUSED / cible non déchiffrée / aucun pointage / horizon dégénéré.
 * Calculée même en overdue (compagnon factuel de D1).
 */
function computeEstimatedCompletion(input: {
  status: SavingsGoalStatus;
  targetAmount: number;
  confirmed: number;
  confirmedPace: number;
  indexCurrent: number;
}): BudgetPeriod | null {
  if (input.status === 'PAUSED' || input.targetAmount <= 0) return null;
  if (input.confirmed >= input.targetAmount) {
    return periodFromIndex(input.indexCurrent);
  }
  if (input.confirmedPace <= 0) return null;
  const monthsNeeded = Math.ceil(
    (input.targetAmount - input.confirmed) / input.confirmedPace,
  );
  if (monthsNeeded > MAX_ESTIMATED_HORIZON_MONTHS) return null;
  return periodFromIndex(input.indexCurrent + monthsNeeded);
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

export interface SuggestedMonthlyContributionInput {
  targetAmount: number;
  /** ISO date `YYYY-MM-DD`. */
  targetDate: string;
  payDayOfMonth?: number | null;
  /** Injectable pour les tests ; défaut = maintenant. */
  now?: Date;
}

/**
 * Suggestion « cible ÷ mois restants » à la création d'un objectif (PUL-285
 * CA1/CA6). Même base que la formule 5 (`required` avec confirmé = 0) :
 * payDay-aware, mois courant ET mois d'échéance inclus. Arrondi au centime
 * SUPÉRIEUR pour que `suggestion × mois ≥ cible` (jamais de shortfall à
 * l'échéance). `null` si l'échéance est dépassée ou la cible non positive.
 */
export function suggestedMonthlyContribution(
  input: SuggestedMonthlyContributionInput,
): number | null {
  const now = input.now ?? new Date();
  const indexCurrent = periodIndex(
    getBudgetPeriodForDate(now, input.payDayOfMonth),
  );
  const indexTarget = periodIndex(
    getBudgetPeriodForDate(parseIsoDateLocal(input.targetDate), input.payDayOfMonth),
  );
  const monthsRemaining = indexTarget - indexCurrent + 1;
  if (monthsRemaining <= 0 || input.targetAmount <= 0) return null;
  return Math.ceil((input.targetAmount / monthsRemaining) * 100) / 100;
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

  // 10. Écart cumulé — signé, jamais clampé (négatif = pointage anticipé/avance).
  const cumulativeGap = plannedCumulative - confirmed;

  // 11. Date d'atteinte estimée au rythme confirmé (payDay-aware).
  const estimatedCompletion = computeEstimatedCompletion({
    status: input.status,
    targetAmount: input.targetAmount,
    confirmed,
    confirmedPace,
    indexCurrent,
  });

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
    cumulativeGap,
    estimatedCompletion,
  };
}
