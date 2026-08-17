/**
 * @fileoverview Export public des calculateurs métier
 *
 * NOTE IMPORTANTE: Les imports utilisent l'extension .js (pas .ts) car ce package
 * est compilé en ESM natif pour Node.js. C'est une exigence stricte de Node.js
 * pour la résolution des modules ESM, même si nous écrivons en TypeScript.
 *
 * Sans ces extensions .js, l'application crash en production avec ERR_MODULE_NOT_FOUND.
 * Voir shared/README.md section "Résolution des Modules ESM" pour plus de détails.
 */

export { BudgetFormulas, isOutflowKind } from './budget-formulas.js';
export { splitTotalPreserving } from './spread-split.js';
export {
  PACE_TOLERANCE_PERCENT,
  MAX_ESTIMATED_HORIZON_MONTHS,
  calculatePaceStatus,
  computeSavingsGoalProgress,
  remainingPlannedWithdrawal,
  suggestedMonthlyContribution,
  type LinkedPlannedWithdrawal,
  type LinkedSavingLine,
  type LinkedSavingTransaction,
  type LinkedSavingWithdrawal,
  type SavingsGoalProgressInput,
  type SavingsGoalProgressResult,
  type SuggestedMonthlyContributionInput,
} from './savings-goal-progress.js';
export {
  buildSavingsGoalTimeline,
  simulateSavingsPlan,
  redistributeRemainingEffort,
  allocateMonthAmountToLines,
  currentPlanMovement,
  isContributivePlanMonth,
  isOpenPlanMonth,
  type SavingsPlanMonthState,
  type SavingsPlanLine,
  type SavingsPlanTimelineMonth,
  type SavingsPlanAdjustment,
  type SavingsPlanSimulatedMonth,
  type SavingsPlanSimulationResult,
  type RedistributeRemainingEffortResult,
  type AllocatableLine,
} from './savings-goal-plan.js';
export {
  getBudgetPeriodForDate,
  isInCurrentBudgetPeriod,
  compareBudgetPeriods,
  isPastBudgetPeriod,
  getBudgetPeriodDates,
  formatBudgetPeriod,
  periodIndex,
  periodFromIndex,
  parseIsoDateLocal,
  type BudgetPeriod,
  type BudgetPeriodDates,
} from './budget-period.js';
export type * from '../types.js';
