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
  targetAmount: number | null;
  status: SavingsGoalStatus;
  /** ISO datetime — ancrage ramené à son cycle payDay-aware. */
  createdAt: string;
  /** ISO date `YYYY-MM-DD`. Absente ou passée = cycle courant. */
  startDate?: string | null;
  /** ISO date `YYYY-MM-DD`. */
  targetDate: string | null;
  payDayOfMonth?: number | null;
  /** Injectable pour les tests ; défaut = maintenant. */
  now?: Date;
  /** Périodes portant déjà un budget, même sans ligne liée à cet objectif. */
  materializedPeriods?: BudgetPeriod[];
  /** Le Mois Type actif peut créer une ligne Épargne liée à cet objectif. */
  canProvisionMissingPeriods?: boolean;
  lines: LinkedSavingLine[];
  transactions: LinkedSavingTransaction[];
  /**
   * Montant déjà épargné avant le suivi (stock one-shot, ex. capital transféré
   * à la création). S'ajoute au CONFIRMÉ ; exclu du rythme (`confirmedPace`)
   * et de l'écart cumulé (`cumulativeGap`), qui restent des mesures de FLUX.
   */
  initialAmount?: number;
}

export interface SavingsGoalProgressResult {
  plannedCumulative: number;
  /** Montant de départ + prévisions liées dans la fenêtre de contribution. */
  plannedProjection: number;
  confirmed: number;
  achievementPercent: number | null;
  monthsElapsed: number;
  monthsRemaining: number | null;
  isOverdue: boolean;
  pace: number;
  confirmedPace: number;
  required: number | null;
  projected: number | null;
  paceStatus: SavingsGoalPaceStatus | null;
  suggestCompletion: boolean | null;
  linkedLineCount: number;
  /** Formule 10 — écart cumulé `plannedCumulative − confirmed` (signé, jamais clampé). */
  cumulativeGap: number;
  /** Formule 11 — date d'atteinte au rythme confirmé, `null` si non projetable. */
  estimatedCompletion: BudgetPeriod | null;
  /** Écho de `input.initialAmount` (stock de départ), défaut 0. */
  initialAmount: number;
}

/**
 * Date d'atteinte estimée au rythme CONFIRMÉ (docs/SAVINGS.md §10.2).
 * `null` si PAUSED / cible non déchiffrée / aucun pointage / horizon dégénéré.
 * Calculée même en overdue (compagnon factuel de D1).
 */
function computeEstimatedCompletion(input: {
  status: SavingsGoalStatus;
  targetAmount: number | null;
  confirmed: number;
  confirmedPace: number;
  indexCurrent: number;
}): BudgetPeriod | null {
  if (
    input.status === 'PAUSED' ||
    input.targetAmount == null ||
    input.targetAmount <= 0
  ) {
    return null;
  }
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
  /** ISO date `YYYY-MM-DD`. Absente ou passée = cycle courant. */
  startDate?: string | null;
  /** ISO date `YYYY-MM-DD`. */
  targetDate: string;
  payDayOfMonth?: number | null;
  /**
   * Montant déjà épargné (stock) — déduit de la cible avant division : à la
   * création, le confirmé de la formule 5 se réduit exactement à ce stock.
   */
  initialAmount?: number;
  /** Injectable pour les tests ; défaut = maintenant. */
  now?: Date;
}

/**
 * Suggestion « reste à épargner ÷ mois restants » à la création d'un objectif
 * (PUL-285 CA1/CA6). Même base que la formule 5 — `required = max(0, cible −
 * confirmé) / monthsRemaining` — où le confirmé à la création se réduit au
 * montant de départ : payDay-aware, mois courant ET mois d'échéance inclus.
 * Arrondi au centime SUPÉRIEUR pour que `suggestion × mois ≥ reste` (jamais de
 * shortfall à l'échéance). `null` si l'échéance est dépassée, la cible non
 * positive, ou le montant de départ couvre déjà la cible (rien à décomposer).
 */
export function suggestedMonthlyContribution(
  input: SuggestedMonthlyContributionInput,
): number | null {
  const now = input.now ?? new Date();
  const indexCurrent = periodIndex(
    getBudgetPeriodForDate(now, input.payDayOfMonth),
  );
  const indexStart =
    input.startDate == null
      ? indexCurrent
      : periodIndex(
          getBudgetPeriodForDate(
            parseIsoDateLocal(input.startDate),
            input.payDayOfMonth,
          ),
        );
  const effectiveStartIndex = Math.max(indexCurrent, indexStart);
  const indexTarget = periodIndex(
    getBudgetPeriodForDate(
      parseIsoDateLocal(input.targetDate),
      input.payDayOfMonth,
    ),
  );
  const monthsRemaining = indexTarget - effectiveStartIndex + 1;
  if (monthsRemaining <= 0 || input.targetAmount <= 0) return null;
  const remaining = input.targetAmount - (input.initialAmount ?? 0);
  if (remaining <= 0) return null;
  // Le pré-round au 1/100 de centime neutralise l'artefact float binaire :
  // sans lui, un quotient tombant PILE sur un centime (500.05) peut flotter
  // juste au-dessus et se faire ceil au centime supérieur (500.06).
  const cents = Math.round((remaining / monthsRemaining) * 10_000) / 100;
  return Math.ceil(cents) / 100;
}

export function computeSavingsGoalProgress(
  input: SavingsGoalProgressInput,
): SavingsGoalProgressResult {
  const now = input.now ?? new Date();
  const payDay = input.payDayOfMonth;

  const indexCreated = periodIndex(
    getBudgetPeriodForDate(new Date(input.createdAt), payDay),
  );
  const indexCurrent = periodIndex(getBudgetPeriodForDate(now, payDay));
  const indexStart =
    input.startDate == null
      ? indexCreated
      : periodIndex(
          getBudgetPeriodForDate(parseIsoDateLocal(input.startDate), payDay),
        );
  const historicalAnchorIndex = Math.max(indexCreated, indexStart);
  const remainingStartIndex = Math.max(indexCurrent, historicalAnchorIndex);
  const indexTarget =
    input.targetDate == null
      ? null
      : periodIndex(
          getBudgetPeriodForDate(parseIsoDateLocal(input.targetDate), payDay),
        );

  const monthsElapsed = Math.max(1, indexCurrent - historicalAnchorIndex + 1);
  const monthsRemaining =
    indexTarget == null ? null : indexTarget - remainingStartIndex + 1;
  const isOverdue =
    indexTarget == null ? false : indexTarget - indexCurrent + 1 <= 0;

  // Double garde kind=saving (le lien est déjà kind-guardé à l'écriture) +
  // exclusion des lignes de report virtuelles côté client.
  const allSavingLines = input.lines.filter(
    (line) => line.kind === 'saving' && line.isRollover !== true,
  );
  const savingLines = allSavingLines.filter(
    (line) => periodIndex(line) >= historicalAnchorIndex,
  );

  // 1. Prévu cumulé — pur line.amount des mois ≤ courant, PAS d'enveloppe.
  const plannedCumulative = savingLines
    .filter((line) => periodIndex(line) <= indexCurrent)
    .reduce((sum, line) => sum + line.amount, 0);
  const initialAmount = input.initialAmount ?? 0;
  const plannedProjection =
    initialAmount +
    savingLines
      .filter((line) => indexTarget == null || periodIndex(line) <= indexTarget)
      .reduce((sum, line) => sum + line.amount, 0);

  // 2. Confirmé — enveloppe checked-only, TOUS mois (pointage anticipé compte).
  // `confirmed` (STOCK) additionne le montant de départ ; `linesConfirmed`
  // (FLUX) en reste exclu pour le rythme et l'écart cumulé.
  const linesConfirmed = BudgetFormulas.calculateRealizedSavings(
    savingLines,
    input.transactions,
  );
  const confirmed = initialAmount + linesConfirmed;

  // 3. % d'atteinte — sur le CONFIRMÉ ; cible nulle/non déchiffrée ⇒ 0.
  const achievementPercent =
    input.targetAmount == null
      ? null
      : input.targetAmount > 0
        ? Math.round(Math.min(confirmed / input.targetAmount, 1) * 100)
        : 0;

  // 4. Deux rythmes — mesures de FLUX, indépendantes de la projection du plan.
  // confirmedPace exclut le montant de départ (un stock n'est pas un rythme).
  const pace = plannedCumulative / monthsElapsed;
  const confirmedPace = linesConfirmed / monthsElapsed;

  // 5. Requis — neutralisé sans cible/échéance ou quand elle est dépassée.
  const required =
    input.targetAmount == null || monthsRemaining == null || isOverdue
      ? null
      : Math.max(0, input.targetAmount - confirmed) / monthsRemaining;

  // 6. Projection à l'échéance — actif confirmé + reliquat du plan courant/futur.
  // Le max mensuel évite de recompter une contribution déjà pointée et conserve
  // un éventuel dépassement réel dans `confirmed`.
  const remainingLinesByPeriod = new Map<number, LinkedSavingLine[]>();
  if (indexTarget != null) {
    for (const line of savingLines) {
      const index = periodIndex(line);
      if (index < indexCurrent || index > indexTarget) continue;
      const periodLines = remainingLinesByPeriod.get(index) ?? [];
      periodLines.push(line);
      remainingLinesByPeriod.set(index, periodLines);
    }
  }
  const plannedRemaining = [...remainingLinesByPeriod.values()].reduce(
    (total, periodLines) => {
      const planned = periodLines.reduce((sum, line) => sum + line.amount, 0);
      const realized = BudgetFormulas.calculateRealizedSavings(
        periodLines,
        input.transactions,
      );
      return total + Math.max(0, planned - realized);
    },
    0,
  );
  const projected =
    input.targetAmount == null || indexTarget == null
      ? null
      : confirmed + plannedRemaining;

  // 7. Statut du plan — PAUSED et échéance dépassée n'ont PAS de jugement.
  const paceStatus =
    input.status === 'PAUSED' ||
    isOverdue ||
    input.targetAmount == null ||
    input.targetAmount <= 0
      ? null
      : projected == null
        ? null
        : calculatePaceStatus(projected, input.targetAmount);

  // D2 — suggérer « marquer terminé ? » sur le confirmé, jamais d'auto-flip.
  const suggestCompletion =
    input.targetAmount == null
      ? null
      : input.status === 'ACTIVE' &&
        input.targetAmount > 0 &&
        confirmed >= input.targetAmount;

  // 10. Écart cumulé — signé, jamais clampé (négatif = pointage anticipé/avance).
  // Adhérence au plan de pointage (FLUX) ⇒ exclut le montant de départ.
  const cumulativeGap = plannedCumulative - linesConfirmed;

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
    plannedProjection,
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
    linkedLineCount: allSavingLines.length,
    cumulativeGap,
    estimatedCompletion,
    initialAmount,
  };
}
