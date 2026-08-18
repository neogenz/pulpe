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
import { moneyDifference } from '../money.js';
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

/**
 * Retrait (PUL-329) : Revenu LIBRE dont l'origine est cet objectif. Sortie de
 * STOCK, jamais une contribution négative — d'où un type distinct de
 * `LinkedSavingTransaction`, qui décrit l'entrée d'argent allouée à une
 * prévision. `month`/`year` sont la période du budget porteur (payDay-aware),
 * pas la date de saisie : c'est elle qui situe le retrait dans la chronologie.
 * Le montant est POSITIF ; c'est le calcul qui le soustrait.
 */
export interface LinkedSavingWithdrawal {
  amount: number;
  month: number;
  year: number;
  /**
   * Prévision de retrait que ce réel réalise, quand il en réalise une. `null` =
   * retrait libre. C'est par lui que le reliquat cesse de compter une sortie
   * déjà survenue — sans quoi le prévu et le réel se retrancheraient tous deux.
   */
  budgetLineId?: string | null;
}

/**
 * Retrait PLANIFIÉ : une prévision `income` qui annonce « ce montant sortira de
 * l'objectif à cette période ». Elle ne touche pas le stock confirmé — rien
 * n'est encore sorti — mais elle abaisse la projection, exactement comme une
 * contribution prévue la relève. Montant POSITIF ; c'est le calcul qui soustrait.
 */
export interface LinkedPlannedWithdrawal {
  /** Id de la prévision — celui que porte `LinkedSavingWithdrawal.budgetLineId`. */
  id: string;
  amount: number;
  month: number;
  year: number;
  /** `plan` = direct hors budget ; `plan_linked` = revenu créé par le plan. */
  origin?: 'budget' | 'plan' | 'plan_linked';
}

/**
 * Ce qu'une prévision de retrait annonce ENCORE. La part déjà prélevée est
 * sortie du stock et vit dans `confirmed` ; ne garder que le reste est ce qui
 * empêche de compter deux fois la même sortie. Un réel supérieur au prévu ne
 * crée jamais de reliquat négatif — l'excédent est déjà dans `confirmed`, le
 * remonter ici gonflerait artificiellement la projection.
 */
export function remainingPlannedWithdrawal(
  planned: LinkedPlannedWithdrawal,
  withdrawals: LinkedSavingWithdrawal[],
): number {
  if (planned.origin === 'plan') return planned.amount;
  const realized = withdrawals
    .filter((withdrawal) => withdrawal.budgetLineId === planned.id)
    .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
  return Math.max(0, moneyDifference(planned.amount, realized));
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
  /**
   * Le Mois Type actif rend une période sans budget matérialisé éligible à
   * une création automatique — un facteur parmi ceux d'`isProvisionable`
   * (voir `buildSavingsGoalTimeline`), qui exige aussi un horizon cible
   * (`targetDate`) dans tous les cas. La ligne n'est pas créée ici : ce
   * calculateur expose seulement l'éligibilité, la création a lieu
   * côté serveur à l'application du plan.
   */
  canProvisionMissingPeriods?: boolean;
  lines: LinkedSavingLine[];
  transactions: LinkedSavingTransaction[];
  /**
   * Montant déjà épargné avant le suivi (stock one-shot, ex. capital transféré
   * à la création). S'ajoute au CONFIRMÉ ; exclu du rythme (`confirmedPace`)
   * et de l'écart cumulé (`cumulativeGap`), qui restent des mesures de FLUX.
   */
  initialAmount?: number;
  /**
   * Retraits liés (PUL-329). Se soustraient du CONFIRMÉ dès leur création,
   * indépendamment du pointage. Ils n'entrent jamais dans `confirmedPace` : ce
   * qu'on retire du pot ne change pas la capacité mensuelle à le remplir.
   */
  withdrawals?: LinkedSavingWithdrawal[];
  /**
   * Retraits ANNONCÉS. Ils ne touchent ni `confirmed` ni les rythmes — rien
   * n'est sorti — mais leur reliquat courant/futur se retranche de `projected`,
   * jusqu'à l'échéance seulement : une prévision passée non réalisée est échue,
   * elle ne se réalise pas fictivement plus tard.
   */
  plannedWithdrawals?: LinkedPlannedWithdrawal[];
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
    moneyDifference(input.targetAmount, 0) <= 0
  ) {
    return null;
  }
  if (moneyDifference(input.confirmed, input.targetAmount) >= 0) {
    return periodFromIndex(input.indexCurrent);
  }
  if (input.confirmedPace <= 0) return null;
  const monthsNeeded = Math.ceil(
    moneyDifference(input.targetAmount, input.confirmed) / input.confirmedPace,
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
  const remaining = moneyDifference(
    input.targetAmount,
    input.initialAmount ?? 0,
  );
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
  // `confirmed` (STOCK) additionne le montant de départ et retranche les
  // retraits ; `linesConfirmed` (FLUX) reste la seule base du rythme.
  // Aucun clamp à zéro : l'écriture interdit le découvert, mais une
  // incohérence historique doit rester visible aux diagnostics.
  const linesConfirmed = BudgetFormulas.calculateRealizedSavings(
    savingLines,
    input.transactions,
  );
  const withdrawals = input.withdrawals ?? [];
  const withdrawn = withdrawals.reduce(
    (sum, withdrawal) => sum + withdrawal.amount,
    0,
  );
  const withdrawnUntilNow = withdrawals
    .filter((withdrawal) => periodIndex(withdrawal) <= indexCurrent)
    .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
  const confirmed = initialAmount + linesConfirmed - withdrawn;

  // 3. % d'atteinte — sur le CONFIRMÉ ; cible nulle/non déchiffrée ⇒ 0.
  // Borné des deux côtés : `confirmed` reste signé pour le diagnostic, mais un
  // stock négatif — dépointer une ligne déjà retirée y suffit — ne peut pas
  // sortir en pourcentage négatif. Le contrat le refuse (`min(0)`) et le client
  // web parse la réponse : un retrait ferait tomber TOUT l'écran de progression.
  const targetAmount =
    input.targetAmount == null ? null : moneyDifference(input.targetAmount, 0);
  const confirmedAtCents = moneyDifference(confirmed, 0);
  const achievementPercent =
    targetAmount == null
      ? null
      : targetAmount > 0
        ? Math.round(
            Math.max(0, Math.min(confirmedAtCents / targetAmount, 1)) * 100,
          )
        : 0;

  // 4. Deux rythmes — mesures de FLUX, indépendantes de la projection du plan.
  // confirmedPace exclut le montant de départ (un stock n'est pas un rythme).
  const pace = plannedCumulative / monthsElapsed;
  const confirmedPace = linesConfirmed / monthsElapsed;

  // 5. Requis — neutralisé sans cible/échéance ou quand elle est dépassée.
  const required =
    input.targetAmount == null || monthsRemaining == null || isOverdue
      ? null
      : Math.max(0, moneyDifference(input.targetAmount, confirmed)) /
        monthsRemaining;

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
      return total + Math.max(0, moneyDifference(planned, realized));
    },
    0,
  );
  // Le reliquat annoncé se retranche de la même fenêtre que le reliquat prévu :
  // courant → échéance. Une prévision de retrait échue n'a pas eu lieu et
  // n'aura pas lieu — la reporter plus tard ferait porter à la projection une
  // sortie que personne n'a demandée.
  const plannedWithdrawalRemaining =
    indexTarget == null
      ? 0
      : (input.plannedWithdrawals ?? [])
          .filter((planned) => {
            const index = periodIndex(planned);
            return index >= remainingStartIndex && index <= indexTarget;
          })
          .reduce(
            (total, planned) =>
              total + remainingPlannedWithdrawal(planned, withdrawals),
            0,
          );
  const projected =
    input.targetAmount == null || indexTarget == null
      ? null
      : confirmed + plannedRemaining - plannedWithdrawalRemaining;

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
        moneyDifference(input.targetAmount, 0) > 0 &&
        moneyDifference(confirmed, input.targetAmount) >= 0;

  // 10. Écart cumulé — signé, jamais clampé (négatif = pointage anticipé/avance).
  // Adhérence au plan de pointage (FLUX) ⇒ exclut le montant de départ, mais
  // retranche les retraits DÉJÀ survenus : l'argent repris creuse le retard sur
  // le cumul prévu. Un retrait daté d'un mois futur n'y compte pas encore.
  const cumulativeGap = moneyDifference(
    plannedCumulative,
    linesConfirmed - withdrawnUntilNow,
  );

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
