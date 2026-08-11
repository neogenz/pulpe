import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useVaultStore } from "@/core/vault/vault-store";
import { budgetKeys } from "@/features/budgets/budget-queries";

import {
  applySavingsGoalPlan,
  createSavingsGoal,
  deleteSavingsGoal,
  fetchSavingsGoal,
  fetchSavingsGoalContributions,
  fetchSavingsGoalDeletionImpact,
  fetchSavingsGoalFutureLines,
  fetchSavingsGoalProgress,
  fetchSavingsGoals,
  fetchSavingsGoalWithdrawals,
  stopSavingsGoalGeneration,
  updateSavingsGoal,
} from "./goals-api";

export const goalKeys = {
  all: ["savings-goals"] as const,
  list: () => ["savings-goals", "list"] as const,
  detail: (goalId: string) => ["savings-goals", "detail", goalId] as const,
  progress: (goalId: string) => ["savings-goals", "progress", goalId] as const,
  contributions: (goalId: string) =>
    ["savings-goals", "contributions", goalId] as const,
  withdrawals: (goalId: string) =>
    ["savings-goals", "withdrawals", goalId] as const,
  futureLines: (goalId: string) =>
    ["savings-goals", "future-lines", goalId] as const,
  deletionImpact: (goalId: string) =>
    ["savings-goals", "deletion-impact", goalId] as const,
};

/**
 * Every read here decrypts amounts, so none of them may run before the vault
 * is open — same gate as the budget queries.
 */
function useUnlocked(): boolean {
  return useVaultStore((state) => state.status === "unlocked");
}

export function useSavingsGoals() {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: goalKeys.list(),
    queryFn: fetchSavingsGoals,
    enabled: isUnlocked,
  });
}

export function useSavingsGoal(goalId: string) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: goalKeys.detail(goalId),
    queryFn: () => fetchSavingsGoal(goalId),
    enabled: isUnlocked,
  });
}

export function useSavingsGoalProgress(goalId: string) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: goalKeys.progress(goalId),
    queryFn: () => fetchSavingsGoalProgress(goalId),
    enabled: isUnlocked,
  });
}

export function useSavingsGoalContributions(goalId: string) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: goalKeys.contributions(goalId),
    queryFn: () => fetchSavingsGoalContributions(goalId),
    enabled: isUnlocked,
  });
}

export function useSavingsGoalWithdrawals(goalId: string) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: goalKeys.withdrawals(goalId),
    queryFn: () => fetchSavingsGoalWithdrawals(goalId),
    enabled: isUnlocked,
  });
}

export function useSavingsGoalFutureLines(goalId: string) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: goalKeys.futureLines(goalId),
    queryFn: () => fetchSavingsGoalFutureLines(goalId),
    enabled: isUnlocked,
  });
}

/**
 * Only fetched when the deletion sheet is open: the answer is a snapshot the
 * server then checks the mutation against, so a stale one would be refused.
 */
export function useSavingsGoalDeletionImpact(goalId: string | null) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: goalKeys.deletionImpact(goalId ?? "none"),
    queryFn: () => fetchSavingsGoalDeletionImpact(goalId as string),
    enabled: goalId !== null && isUnlocked,
  });
}

/**
 * A goal owns forecasts inside budgets, so writing one moves both trees. Both
 * prefixes go at once rather than each mutation naming what it touched.
 */
function useGoalMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useCreateSavingsGoal() {
  return useGoalMutation(createSavingsGoal);
}

export function useUpdateSavingsGoal() {
  return useGoalMutation(updateSavingsGoal);
}

export function useDeleteSavingsGoal() {
  return useGoalMutation(deleteSavingsGoal);
}

export function useStopSavingsGoalGeneration() {
  return useGoalMutation(stopSavingsGoalGeneration);
}

export function useApplySavingsGoalPlan() {
  return useGoalMutation(applySavingsGoalPlan);
}
