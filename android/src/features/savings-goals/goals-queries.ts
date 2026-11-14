import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { SavingsGoal, SavingsGoalProgress } from "pulpe-shared";

import { useVaultStore } from "@/core/vault/vault-store";
import { budgetKeys } from "@/features/budgets/budget-queries";

import {
  applySavingsGoalPlan,
  createSavingsGoal,
  deleteSavingsGoal,
  fetchSavingsGoal,
  fetchSavingsGoalDeletionImpact,
  fetchSavingsGoalFutureLines,
  fetchSavingsGoalProgress,
  fetchSavingsGoals,
  fetchSavingsGoalWithdrawalOptions,
  fetchSavingsGoalWithdrawals,
  stopSavingsGoalGeneration,
  updateSavingsGoal,
} from "./goals-api";

export const goalKeys = {
  all: ["savings-goals"] as const,
  list: () => ["savings-goals", "list"] as const,
  detail: (goalId: string) => ["savings-goals", "detail", goalId] as const,
  progress: (goalId: string) => ["savings-goals", "progress", goalId] as const,
  withdrawals: (goalId: string) =>
    ["savings-goals", "withdrawals", goalId] as const,
  withdrawalOptions: () => ["savings-goals", "withdrawal-options"] as const,
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

/**
 * One progress read per goal: the list shows each goal's confirmed amount and
 * bar, and no endpoint answers for them all. Same keys as the detail screen,
 * so opening a goal reuses what the list already fetched.
 */
export function useSavingsGoalsProgress(goals: SavingsGoal[]) {
  const isUnlocked = useUnlocked();

  return useQueries({
    queries: goals.map((goal) => ({
      queryKey: goalKeys.progress(goal.id),
      queryFn: () => fetchSavingsGoalProgress(goal.id),
      enabled: isUnlocked,
    })),
    combine: (results) => {
      const byGoalId: Record<string, SavingsGoalProgress> = {};
      results.forEach((result, index) => {
        if (result.data !== undefined) byGoalId[goals[index].id] = result.data;
      });
      return byGoalId;
    },
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

export function useSavingsGoalWithdrawals(goalId: string) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: goalKeys.withdrawals(goalId),
    queryFn: () => fetchSavingsGoalWithdrawals(goalId),
    enabled: isUnlocked,
  });
}

/**
 * Balances the user is about to spend against, so they are asked for only
 * while the form that needs them is open — and never cached past it, since a
 * refused withdrawal is proof the numbers on screen were stale.
 */
export function useSavingsGoalWithdrawalOptions(isEnabled: boolean) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: goalKeys.withdrawalOptions(),
    queryFn: fetchSavingsGoalWithdrawalOptions,
    enabled: isUnlocked && isEnabled,
    staleTime: 0,
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
 * A goal owns forecasts inside budgets, so writing one moves both trees. The
 * sweep stays: a plan or a deletion touches every month the goal generated
 * into, the budget list's totals included.
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
