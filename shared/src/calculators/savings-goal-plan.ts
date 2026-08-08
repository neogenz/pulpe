/**
 * @fileoverview SAVINGS GOAL PLAN — timeline mensuelle + simulation client (PUL-12+).
 *
 * Source de vérité métier : docs/SAVINGS.md §10.3. Fonctions PURES, payDay-aware.
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
  LinkedPlannedWithdrawal,
  LinkedSavingLine,
  LinkedSavingTransaction,
  LinkedSavingWithdrawal,
} from './savings-goal-progress.js';
import { remainingPlannedWithdrawal } from './savings-goal-progress.js';
import { splitTotalPreserving } from './spread-split.js';
import { MAX_SAVINGS_GOAL_PLAN_PERIODS } from '../../schemas.js';

/** État temporel/structurel d'un mois du plan (docs/SAVINGS.md §10.2). */
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
  /** La période appartient à la fenêtre début → échéance de contribution. */
  isContributionEligible?: boolean;
  /** Le budget de la période est déjà matérialisé. */
  hasBudget?: boolean;
  /** Prévision absente pouvant être créée dans un budget nouveau ou existant. */
  isProvisionable?: boolean;
  /** Σ line.amount des lignes épargne liées, ce mois. */
  plannedAmount: number;
  /** Enveloppe checked-only (`calculateRealizedSavings`) pour ce mois. */
  confirmedAmount: number;
  /**
   * Σ des retraits (§11) portés par ce mois, toujours positive. Sortie de stock :
   * elle creuse les cumuls, jamais `confirmedAmount`. Optionnelle — les payloads
   * antérieurs à PUL-329 ne la portent pas.
   *
   * Sur la PREMIÈRE row, elle porte en plus les retraits antérieurs à la
   * fenêtre, que l'horizon de 120 périodes a écartés : le mois d'ouverture
   * cumule ce qui a quitté le stock jusqu'à lui, comme `initialAmount` cumule
   * ce qui y est entré. À libeller « retiré jusqu'ici » et non « retiré ce
   * mois-ci » si une UI vient un jour l'afficher ligne à ligne.
   */
  withdrawnAmount?: number;
  /**
   * Σ BRUTE des retraits ANNONCÉS pour ce mois — ce que la prévision affiche,
   * réalisé ou non. Sert à l'écrire dans le calendrier ; jamais aux cumuls, qui
   * doubleraient la part déjà sortie.
   */
  plannedWithdrawalAmount?: number;
  /**
   * Part encore à sortir de ces mêmes prévisions. Zéro sur un mois passé (la
   * prévision est échue) et hors de la fenêtre de contribution (au-delà de
   * l'échéance, l'objectif n'est plus jugé). C'est CE montant que les cumuls
   * retranchent, en plus des retraits réels.
   */
  remainingPlannedWithdrawalAmount?: number;
  /** Sous-ensemble direct du reliquat, saisi dans le plan sans budget. */
  planOnlyWithdrawalAmount?: number;
  plannedCumulative: number;
  confirmedCumulative: number;
  /**
   * Solde attendu à la fin de ce mois si le plan se déroule tel quel : confirmé
   * acquis, reliquat prévu ajouté, sorties réelles et annoncées retranchées.
   * C'est le nombre qu'un aperçu « combien restera-t-il en mars ? » doit lire —
   * `confirmedCumulative` ne connaît que le passé pointé.
   */
  projectedCumulative?: number;
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

/** Mois participant aux simulations globales et à la redistribution. */
export function isContributivePlanMonth(
  month: SavingsPlanTimelineMonth,
): boolean {
  return (
    month.isContributionEligible !== false &&
    (isOpenPlanMonth(month) || month.isProvisionable === true)
  );
}

/**
 * Construit la timeline mensuelle ancrage → cible (inclus), en garantissant que
 * l'ancrage, le mois courant, la cible ET chaque ligne liée possèdent une row.
 * Les mois sans ligne liée sont `gap` (le mois courant garde `current` pour le
 * badge, même sans ligne). Les cumulatifs à `indexCourant` égalent
 * `plannedCumulative` (mois ≤ courant) et le total confirmé de `computeSavingsGoalProgress`.
 * `confirmedCumulative` démarre à `input.initialAmount` (stock de départ) ;
 * `plannedCumulative` reste à 0 — le prévu n'a jamais de montant de départ.
 */
export function buildSavingsGoalTimeline(
  input: SavingsGoalProgressInput,
): SavingsPlanTimelineMonth[] {
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
  const indexTarget =
    input.targetDate == null
      ? null
      : periodIndex(
          getBudgetPeriodForDate(parseIsoDateLocal(input.targetDate), payDay),
        );

  const savingLines = input.lines.filter(
    (line) => line.kind === 'saving' && line.isRollover !== true,
  );

  const lineIndices = savingLines.map((line) => periodIndex(line));
  const withdrawals = input.withdrawals ?? [];
  // Un mois qui ne porte qu'un retrait mérite sa row : sans elle, la sortie
  // d'argent disparaîtrait de la courbe et `confirmedCumulative` cesserait
  // d'égaler le confirmé de `computeSavingsGoalProgress`.
  const withdrawalIndices = withdrawals.map((withdrawal) =>
    periodIndex(withdrawal),
  );
  // Une prévision de retrait mérite sa row pour la même raison qu'un retrait
  // réel : sans elle, la sortie annoncée n'apparaîtrait nulle part dans le
  // calendrier, et l'utilisateur verrait un plan qui ignore ce qu'il a planifié.
  const plannedWithdrawals = input.plannedWithdrawals ?? [];
  const plannedWithdrawalIndices = plannedWithdrawals.map((planned) =>
    periodIndex(planned),
  );
  const rawStartIndex = Math.min(
    historicalAnchorIndex,
    indexCurrent,
    ...lineIndices,
    ...withdrawalIndices,
    ...plannedWithdrawalIndices,
  );
  const rawEndIndex = Math.max(
    indexTarget ?? indexCurrent,
    ...lineIndices,
    ...withdrawalIndices,
    ...plannedWithdrawalIndices,
  );
  const endIndex =
    indexTarget == null
      ? rawEndIndex
      : Math.min(rawEndIndex, indexCurrent + MAX_SAVINGS_GOAL_PLAN_PERIODS - 1);
  const startIndex =
    indexTarget == null
      ? rawStartIndex
      : Math.max(rawStartIndex, endIndex - MAX_SAVINGS_GOAL_PLAN_PERIODS + 1);
  const materializedPeriodIndices = input.materializedPeriods
    ? new Set(input.materializedPeriods.map(periodIndex))
    : null;

  // Une échéance à l'horizon maximal sature la fenêtre et fait remonter
  // `startIndex` jusqu'au mois courant : un retrait antérieur perd alors la row
  // où il creusait le cumul. Il a pourtant bien quitté le stock, et
  // `computeSavingsGoalProgress` le retranche sans condition.
  //
  // Il est reporté sur la PREMIÈRE row plutôt que dans un seed local, parce que
  // le seul consommateur de cette fonction est le serveur : le simulateur et la
  // redistribution tournent chez le client, sur `months[]`, et ne connaissent
  // de `initialAmount` que le stock brut de l'objectif. Un seed ici n'aurait
  // corrigé que `confirmedCumulative` en laissant `simulatedFinal` et
  // `remainingEffort` surestimer le stock du montant éjecté. Passer par la row
  // les corrige tous les trois d'un coup, et iOS en hérite sans changer le fil.
  const withdrawnBeforeWindow = withdrawals
    .filter((withdrawal) => periodIndex(withdrawal) < startIndex)
    .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

  const months: SavingsPlanTimelineMonth[] = [];
  let plannedCumulative = 0;
  let confirmedCumulative = input.initialAmount ?? 0;
  let projectedCumulative = input.initialAmount ?? 0;

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
    const isInHistoricalInterval = index >= historicalAnchorIndex;
    const isContributionEligible =
      isInHistoricalInterval && (indexTarget == null || index <= indexTarget);

    // Le retrait creuse le CUMUL confirmé sans jamais entrer dans
    // `confirmedAmount` : la ligne « contributions du mois » reste une somme
    // d'entrées, pas une contribution négative.
    const withdrawnAmount =
      withdrawals
        .filter((withdrawal) => periodIndex(withdrawal) === index)
        .reduce((sum, withdrawal) => sum + withdrawal.amount, 0) +
      (index === startIndex ? withdrawnBeforeWindow : 0);

    // Le retrait ANNONCÉ, lui, reste borné : passé, il est échu ; au-delà de
    // l'échéance, l'objectif n'est plus jugé. Même fenêtre que le reliquat de
    // `computeSavingsGoalProgress`, sans quoi la projection et la simulation
    // raconteraient deux histoires du même plan.
    const monthPlannedWithdrawals = plannedWithdrawals.filter(
      (planned) => periodIndex(planned) === index,
    );
    const plannedWithdrawalAmount = monthPlannedWithdrawals.reduce(
      (sum, planned) => sum + planned.amount,
      0,
    );
    const planOnlyWithdrawalAmount = monthPlannedWithdrawals
      .filter((planned) => planned.origin === 'plan')
      .reduce((sum, planned) => sum + planned.amount, 0);
    const remainingPlannedWithdrawalAmount =
      isContributionEligible && index >= indexCurrent
        ? monthPlannedWithdrawals.reduce(
            (sum, planned) =>
              sum + remainingPlannedWithdrawal(planned, withdrawals),
            0,
          )
        : 0;

    if (isInHistoricalInterval) {
      plannedCumulative += plannedAmount;
      confirmedCumulative += confirmedAmount;
    }

    // Hors du bloc : une sortie de stock compte quel que soit le mois où elle
    // tombe. `computeSavingsGoalProgress` somme TOUS les retraits ; la borner à
    // la fenêtre de contribution ferait diverger le cumul du solde affiché dès
    // qu'un retrait précède le début des contributions — un objectif ouvert
    // avec un montant de départ peut être ponctionné avant sa première prévision.
    confirmedCumulative -= withdrawnAmount;

    // Le projeté suit le même fil, mais compte le plan là où le confirmé compte
    // le pointé : `max` plutôt que somme, pour ne pas recompter une prévision
    // déjà réalisée ni écraser un dépassement réel.
    if (isContributionEligible) {
      projectedCumulative +=
        index >= indexCurrent
          ? Math.max(plannedAmount, confirmedAmount)
          : confirmedAmount;
    }
    // Les deux termes échappent au garde pour des raisons opposées :
    // `withdrawnAmount` par choix — une sortie de stock compte hors fenêtre,
    // comme dit plus haut ; `remainingPlannedWithdrawalAmount` parce que sa
    // définition porte déjà le garde et le rend nul hors fenêtre. Ré-envelopper
    // la ligne l'appliquerait deux fois au second et le perdrait sur le premier.
    projectedCumulative -= withdrawnAmount + remainingPlannedWithdrawalAmount;

    const hasLines = monthLines.length > 0;
    const allChecked =
      hasLines && monthLines.every((line) => line.checkedAt != null);
    const isLocked = index < indexCurrent || allChecked;
    const hasBudget =
      hasLines || materializedPeriodIndices?.has(index) === true;
    const isProvisionable =
      !hasLines &&
      !isLocked &&
      isContributionEligible &&
      materializedPeriodIndices != null &&
      // Un horizon cible est exigé dans TOUS les cas — le serveur refuse toute
      // création de prévision manquante sans lui (apply-savings-goal-plan
      // rejette dès que targetDate == null). `canProvisionMissingPeriods` ne
      // couvre que l'autre question, indépendante : un budget absent peut-il
      // être matérialisé (modèle par défaut) ?
      indexTarget != null &&
      (hasBudget || input.canProvisionMissingPeriods === true);

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
      isContributionEligible,
      hasBudget,
      isProvisionable,
      plannedAmount,
      confirmedAmount,
      withdrawnAmount,
      plannedWithdrawalAmount,
      remainingPlannedWithdrawalAmount,
      planOnlyWithdrawalAmount,
      plannedCumulative,
      confirmedCumulative,
      projectedCumulative,
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
  /** Un changement explicite qui supprime le retrait direct rechargé du mois. */
  replacesPlanOnlyWithdrawal?: boolean;
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
  gapToTarget: number | null;
  isTargetMet: boolean | null;
  /** Premier mois où le cumulé simulé atteint la cible (verdict « atteint en … »). */
  attainedPeriod: BudgetPeriod | null;
}

function adjustmentKey(item: { month: number; year: number }): number {
  return item.year * 12 + item.month;
}

/**
 * Simule le plan : chaque mois verrouillé garde sa réalité (`confirmedAmount`),
 * chaque mois contributif prend `adjustment ?? globalMonthlyAmount ?? plannedAmount`.
 * Une valeur positive remplace la contribution du mois ; une valeur négative
 * remplace son retrait direct hors budget. La réalité déjà confirmée reste
 * acquise dans les deux cas.
 * Cibler un mois verrouillé ou indisponible via `adjustments` lève une erreur (révèle un
 * bug d'UI en développement — même doctrine que `splitTotalPreserving`).
 */
export function simulateSavingsPlan(input: {
  timeline: SavingsPlanTimelineMonth[];
  targetAmount: number | null;
  adjustments?: SavingsPlanAdjustment[];
  globalMonthlyAmount?: number;
  /** Montant de départ (stock) — amorce `simulatedCumulative`, exclu des mois simulés. */
  initialAmount?: number;
}): SavingsPlanSimulationResult {
  const adjustmentsByKey = new Map<number, SavingsPlanAdjustment>();
  for (const adjustment of input.adjustments ?? []) {
    adjustmentsByKey.set(adjustmentKey(adjustment), adjustment);
  }

  const contributiveKeys = new Set(
    input.timeline
      .filter((month) => isContributivePlanMonth(month))
      .map((month) => adjustmentKey(month)),
  );
  for (const key of adjustmentsByKey.keys()) {
    if (!contributiveKeys.has(key)) {
      throw new Error(
        'simulateSavingsPlan: adjustment targets a locked or gap month',
      );
    }
  }

  const months: SavingsPlanSimulatedMonth[] = [];
  let simulatedCumulative = input.initialAmount ?? 0;
  let attainedPeriod: BudgetPeriod | null = null;

  for (const month of input.timeline) {
    const key = adjustmentKey(month);
    const isContributive = isContributivePlanMonth(month);
    const adjustment = adjustmentsByKey.get(key);

    let simulatedAmount: number;
    let isAdjusted = false;
    let isWithdrawalAdjustment = false;
    let replacesExistingPlanWithdrawal = false;
    if (month.isContributionEligible === false) {
      simulatedAmount = 0;
    } else if (!isContributive) {
      simulatedAmount = month.confirmedAmount;
    } else if (adjustment != null) {
      simulatedAmount = adjustment.amount;
      isAdjusted = true;
      isWithdrawalAdjustment = adjustment.amount < 0;
      replacesExistingPlanWithdrawal =
        isWithdrawalAdjustment ||
        adjustment.replacesPlanOnlyWithdrawal === true;
    } else if (input.globalMonthlyAmount != null) {
      simulatedAmount = input.globalMonthlyAmount;
      isAdjusted = simulatedAmount !== month.plannedAmount;
    } else if ((month.planOnlyWithdrawalAmount ?? 0) > 0) {
      simulatedAmount = -(month.planOnlyWithdrawalAmount ?? 0);
      isWithdrawalAdjustment = true;
      replacesExistingPlanWithdrawal = true;
    } else {
      simulatedAmount = month.plannedAmount;
    }

    if (month.isContributionEligible !== false) {
      simulatedCumulative += isWithdrawalAdjustment
        ? Math.max(month.plannedAmount, month.confirmedAmount) + simulatedAmount
        : Math.max(simulatedAmount, month.confirmedAmount);
    }

    // Hors du garde, et APRÈS le max : le retrait est une sortie de stock, il
    // ne concourt jamais avec la contribution du mois et ne dépend pas de la
    // fenêtre de contribution — même règle que dans la timeline. Le reliquat
    // annoncé le suit : il porte déjà sa propre fenêtre, posée à la construction.
    simulatedCumulative -=
      (month.withdrawnAmount ?? 0) +
      Math.max(
        0,
        (month.remainingPlannedWithdrawalAmount ?? 0) -
          (replacesExistingPlanWithdrawal
            ? (month.planOnlyWithdrawalAmount ?? 0)
            : 0),
      );
    if (
      attainedPeriod == null &&
      month.isContributionEligible !== false &&
      input.targetAmount != null &&
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
  const isTargetMet =
    input.targetAmount == null
      ? null
      : input.targetAmount > 0 && simulatedFinal >= input.targetAmount;
  return {
    months,
    simulatedFinal,
    gapToTarget:
      input.targetAmount == null ? null : input.targetAmount - simulatedFinal,
    isTargetMet,
    // Un retrait rend la courbe non monotone : un cumul peut franchir la cible
    // puis repasser dessous. Annoncer « atteint en mars » sous un final
    // inférieur à la cible ferait mentir le verdict des deux clients.
    attainedPeriod: isTargetMet === false ? null : attainedPeriod,
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
 * `remaining = max(0, target − initialAmount − Σ confirmé(mois verrouillés) + Σ sorties(tous les mois) − Σ épinglés ouverts)`.
 * La sortie entre en plus : l'argent repris — ou annoncé comme devant l'être —
 * est de l'effort à refaire. Elle somme retraits réels ET reliquats annoncés
 * sur TOUS les mois de la timeline, sans condition : c'est exactement
 * l'ensemble que `simulateSavingsPlan` soustrait, et cette égalité est ce qui
 * fait retomber la simulation sur la cible après redistribution.
 * `isDistributable = false` quand aucun mois ouvert non épinglé (ex. overdue).
 */
export function redistributeRemainingEffort(input: {
  timeline: SavingsPlanTimelineMonth[];
  targetAmount: number | null;
  pinnedAdjustments?: SavingsPlanAdjustment[];
  /** Montant de départ (stock) — déduit de la cible avant répartition. */
  initialAmount?: number;
}): RedistributeRemainingEffortResult {
  if (input.targetAmount == null) {
    return {
      adjustments: [],
      remainingEffort: 0,
      perRemainingMonth: 0,
      isDistributable: false,
    };
  }

  const pinnedByKey = new Map<number, SavingsPlanAdjustment>();
  for (const pin of input.pinnedAdjustments ?? []) {
    pinnedByKey.set(adjustmentKey(pin), pin);
  }

  const openMonths = input.timeline.filter((month) =>
    isContributivePlanMonth(month),
  );
  const openUnpinned = openMonths.filter(
    (month) => !pinnedByKey.has(adjustmentKey(month)),
  );

  const lockedConfirmedSum = input.timeline
    .filter((month) => month.isContributionEligible !== false && month.isLocked)
    .reduce((sum, month) => sum + month.confirmedAmount, 0);

  const withdrawnSum = input.timeline.reduce((sum, month) => {
    const pinned = pinnedByKey.get(adjustmentKey(month));
    const replacesExistingPlanWithdrawal =
      pinned != null &&
      (pinned.amount < 0 || pinned.replacesPlanOnlyWithdrawal === true);
    return (
      sum +
      (month.withdrawnAmount ?? 0) +
      Math.max(
        0,
        (month.remainingPlannedWithdrawalAmount ?? 0) -
          (replacesExistingPlanWithdrawal
            ? (month.planOnlyWithdrawalAmount ?? 0)
            : 0),
      )
    );
  }, 0);

  const pinnedEffect = openMonths
    .filter((month) => pinnedByKey.has(adjustmentKey(month)))
    .reduce((sum, month) => {
      const amount = pinnedByKey.get(adjustmentKey(month))!.amount;
      const preservesContribution = amount < 0;
      return (
        sum -
        amount -
        (preservesContribution
          ? Math.max(month.plannedAmount, month.confirmedAmount)
          : 0)
      );
    }, 0);

  const remaining = Math.max(
    0,
    input.targetAmount -
      (input.initialAmount ?? 0) -
      lockedConfirmedSum +
      withdrawnSum +
      pinnedEffect,
  );

  const hasUnavailablePeriod = input.timeline.some(
    (month) =>
      month.isContributionEligible !== false &&
      !month.isLocked &&
      !isContributivePlanMonth(month),
  );

  if (hasUnavailablePeriod || openUnpinned.length === 0) {
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
 * cents-exact (plus-grand-reste), proportionnel aux montants actuels. Le montant
 * demandé est le total du mois : les lignes pointées en sont déduites avant la
 * répartition. Σ ouverte nulle → split égal. Aucun reste → lignes ouvertes à 0.
 */
export function allocateMonthAmountToLines(
  lines: AllocatableLine[],
  newMonthAmount: number,
): { budgetLineId: string; amount: number }[] {
  const openLines = lines.filter((line) => line.checkedAt == null);
  if (openLines.length === 0) return [];

  const checkedSum = lines
    .filter((line) => line.checkedAt != null)
    .reduce((sum, line) => sum + line.amount, 0);
  const openTarget = Math.max(0, newMonthAmount - checkedSum);

  if (openTarget <= 0) {
    return openLines.map((line) => ({
      budgetLineId: line.budgetLineId,
      amount: 0,
    }));
  }

  const currentSum = openLines.reduce((sum, line) => sum + line.amount, 0);
  if (currentSum <= 0) {
    const shares = splitTotalPreserving(openTarget, openLines.length);
    return openLines.map((line, index) => ({
      budgetLineId: line.budgetLineId,
      amount: shares[index],
    }));
  }

  const totalCents = Math.round(openTarget * CENTS_PER_UNIT);
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

export type {
  LinkedPlannedWithdrawal,
  LinkedSavingLine,
  LinkedSavingTransaction,
  LinkedSavingWithdrawal,
};
