import {
  type SavingsGoal,
  type SavingsGoalContribution,
  savingsGoalContributionsResponseSchema,
  type SavingsGoalCreate,
  savingsGoalCreateSchema,
  type SavingsGoalDeletionCommand,
  savingsGoalDeletionCommandSchema,
  type SavingsGoalDeletionImpact,
  savingsGoalDeletionImpactResponseSchema,
  type SavingsGoalFutureLine,
  savingsGoalFutureLinesResponseSchema,
  type SavingsGoalGenerationStop,
  savingsGoalGenerationStopSchema,
  savingsGoalGenerationStopResponseSchema,
  savingsGoalListResponseSchema,
  type SavingsGoalPlanApply,
  savingsGoalPlanApplyResponseSchema,
  type SavingsGoalPlanApplyResponse,
  savingsGoalPlanApplySchema,
  type SavingsGoalProgress,
  savingsGoalProgressResponseSchema,
  savingsGoalResponseSchema,
  type SavingsGoalUpdate,
  savingsGoalUpdateSchema,
  type SavingsGoalWithdrawalOption,
  savingsGoalWithdrawalOptionsResponseSchema,
  type SavingsGoalWithdrawalsResponse,
  savingsGoalWithdrawalsResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export function fetchSavingsGoals(): Promise<SavingsGoal[]> {
  return api
    .get(ENDPOINTS.savingsGoals, savingsGoalListResponseSchema)
    .then((response) => response.data);
}

export function fetchSavingsGoal(goalId: string): Promise<SavingsGoal> {
  return api
    .get(ENDPOINTS.savingsGoal(goalId), savingsGoalResponseSchema)
    .then((response) => response.data);
}

/**
 * Everything the detail screen says about where a goal stands — pace, gap,
 * projection — is computed server-side from the linked lines, so the client
 * never has to know which budgets fund it.
 */
export function fetchSavingsGoalProgress(
  goalId: string,
): Promise<SavingsGoalProgress> {
  return api
    .get(
      ENDPOINTS.savingsGoalProgress(goalId),
      savingsGoalProgressResponseSchema,
    )
    .then((response) => response.data);
}

export function fetchSavingsGoalContributions(
  goalId: string,
): Promise<SavingsGoalContribution[]> {
  return api
    .get(
      ENDPOINTS.savingsGoalContributions(goalId),
      savingsGoalContributionsResponseSchema,
    )
    .then((response) => response.data);
}

/**
 * The whole envelope, not just `data`: the realised withdrawals live there, but
 * what was *announced* and not yet taken out lives in `planned` and `planOnly`,
 * and a screen that dropped them would show money leaving with no warning.
 */
export function fetchSavingsGoalWithdrawals(
  goalId: string,
): Promise<SavingsGoalWithdrawalsResponse> {
  return api.get(
    ENDPOINTS.savingsGoalWithdrawals(goalId),
    savingsGoalWithdrawalsResponseSchema,
  );
}

/**
 * The goals that have something to give, with what they hold. Its own endpoint
 * rather than the goals list: only this one carries balances, and the server
 * has already dropped the empty ones.
 */
export function fetchSavingsGoalWithdrawalOptions(): Promise<
  SavingsGoalWithdrawalOption[]
> {
  return api
    .get(
      ENDPOINTS.savingsGoalWithdrawalOptions,
      savingsGoalWithdrawalOptionsResponseSchema,
    )
    .then((response) => response.data);
}

export function fetchSavingsGoalFutureLines(
  goalId: string,
): Promise<SavingsGoalFutureLine[]> {
  return api
    .get(
      ENDPOINTS.savingsGoalFutureLines(goalId),
      savingsGoalFutureLinesResponseSchema,
    )
    .then((response) => response.data);
}

/**
 * What deleting would take with it, asked before anything is written: a goal
 * can have forecasts spread over months of budgets, and the user is entitled to
 * see them before deciding what happens to them.
 */
export function fetchSavingsGoalDeletionImpact(
  goalId: string,
): Promise<SavingsGoalDeletionImpact> {
  return api
    .get(
      ENDPOINTS.savingsGoalDeletionImpact(goalId),
      savingsGoalDeletionImpactResponseSchema,
    )
    .then((response) => response.data);
}

export function createSavingsGoal(
  payload: SavingsGoalCreate,
): Promise<SavingsGoal> {
  return api
    .post<
      { data: SavingsGoal },
      SavingsGoalCreate
    >(ENDPOINTS.savingsGoals, payload, savingsGoalResponseSchema, savingsGoalCreateSchema)
    .then((response) => response.data);
}

export function updateSavingsGoal(input: {
  goalId: string;
  changes: SavingsGoalUpdate;
}): Promise<SavingsGoal> {
  return api
    .patch<
      { data: SavingsGoal },
      SavingsGoalUpdate
    >(ENDPOINTS.savingsGoal(input.goalId), input.changes, savingsGoalResponseSchema, savingsGoalUpdateSchema)
    .then((response) => response.data);
}

/**
 * Deletion is a command, not a verb: the mode says what becomes of the
 * forecasts the goal generated, and the server refuses to guess.
 */
export function deleteSavingsGoal(input: {
  goalId: string;
  command: SavingsGoalDeletionCommand;
}): Promise<void> {
  return api.postVoid(
    ENDPOINTS.savingsGoalDeletion(input.goalId),
    input.command,
    savingsGoalDeletionCommandSchema,
  );
}

/**
 * Applying a simulated plan. The server recomputes the progression afterwards —
 * the client's simulation is a preview, never the authority.
 */
export function applySavingsGoalPlan(input: {
  goalId: string;
  plan: SavingsGoalPlanApply;
}): Promise<void> {
  return api
    .post<
      SavingsGoalPlanApplyResponse,
      SavingsGoalPlanApply
    >(ENDPOINTS.savingsGoalPlan(input.goalId), input.plan, savingsGoalPlanApplyResponseSchema, savingsGoalPlanApplySchema)
    .then(() => undefined);
}

/**
 * The explicit decision on forecasts a stopped goal still holds on future
 * months: keep them, unlinked, or take them out. Never applied automatically —
 * the money is reserved on budgets the user may still be counting on.
 */
export function stopSavingsGoalGeneration(input: {
  goalId: string;
  decision: SavingsGoalGenerationStop;
}): Promise<number> {
  return api
    .post<
      { data: { affectedCount: number } },
      SavingsGoalGenerationStop
    >(ENDPOINTS.savingsGoalGenerationStop(input.goalId), input.decision, savingsGoalGenerationStopResponseSchema, savingsGoalGenerationStopSchema)
    .then((response) => response.data.affectedCount);
}
