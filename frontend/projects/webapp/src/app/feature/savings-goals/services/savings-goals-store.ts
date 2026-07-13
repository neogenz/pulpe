import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type SavingsGoal,
  type SavingsGoalContribution,
  type SavingsGoalCreate,
  type SavingsGoalPlanApply,
  type SavingsGoalPlanApplyResponse,
  type SavingsGoalProgress,
  type SavingsGoalUpdate,
} from 'pulpe-shared';
import { firstValueFrom, map } from 'rxjs';
import { cachedResource, cachedMutation } from 'ngx-ziflux';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';

@Injectable()
export class SavingsGoalStore {
  readonly #api = inject(SavingsGoalApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  readonly savingsGoals = cachedResource({
    cache: this.#api.cache,
    cacheKey: ['savings-goals', 'list'],
    loader: () =>
      this.#api.getAll$().pipe(map((response) => response.data ?? [])),
  });

  readonly goals = computed<SavingsGoal[]>(
    () => this.savingsGoals.value() ?? [],
  );
  readonly isEmpty = computed(() => this.goals().length === 0);

  // ── Detail page (PUL-8) ──
  // One goal is "selected" when a detail page is mounted. The goal entity comes
  // from the already-loaded list (no extra request); progression comes from the
  // dedicated /progress endpoint (server computes every formula).
  readonly #selectedGoalId = signal<string | null>(null);

  readonly selectedGoal = computed<SavingsGoal | null>(() => {
    const id = this.#selectedGoalId();
    if (!id) return null;
    return this.goals().find((goal) => goal.id === id) ?? null;
  });

  readonly #progressResource = cachedResource<
    SavingsGoalProgress,
    { goalId: string }
  >({
    cache: this.#api.cache,
    cacheKey: (params) => ['savings-goals', 'progress', params.goalId],
    params: () => {
      const id = this.#selectedGoalId();
      return id ? { goalId: id } : undefined;
    },
    loader: ({ params }) =>
      firstValueFrom(
        this.#api.getProgress$(params.goalId).pipe(map((res) => res.data)),
      ),
  });

  readonly progress = computed<SavingsGoalProgress | null>(
    () => this.#progressResource.value() ?? null,
  );
  readonly isProgressLoading = this.#progressResource.isInitialLoading;
  readonly progressError = this.#progressResource.error;

  // Linked saving lines + their allocated transactions (across all budgets).
  readonly #contributionsResource = cachedResource<
    SavingsGoalContribution[],
    { goalId: string }
  >({
    cache: this.#api.cache,
    cacheKey: (params) => ['savings-goals', 'contributions', params.goalId],
    params: () => {
      const id = this.#selectedGoalId();
      return id ? { goalId: id } : undefined;
    },
    loader: ({ params }) =>
      firstValueFrom(
        this.#api.getContributions$(params.goalId).pipe(map((res) => res.data)),
      ),
  });

  readonly contributions = computed<SavingsGoalContribution[]>(
    () => this.#contributionsResource.value() ?? [],
  );
  readonly isContributionsLoading =
    this.#contributionsResource.isInitialLoading;

  setSelectedGoalId(id: string | null): void {
    this.#selectedGoalId.set(id);
  }

  reloadProgress(): void {
    this.#progressResource.reload();
  }

  readonly #createMutation = cachedMutation<
    SavingsGoalCreate,
    SavingsGoal,
    void
  >({
    cache: this.#api.cache,
    invalidateKeys: () => [['savings-goals']],
    mutationFn: (goal) =>
      this.#api.create$(goal).pipe(map((response) => response.data)),
    onMutate: () => {
      // Server assigns the id — no stable optimistic entry to insert. The
      // awaited mutate() return value settles the cache; latest-wins gotcha
      // means we never rely on onSuccess to push state.
    },
  });

  readonly #updateMutation = cachedMutation<
    { id: string; updates: SavingsGoalUpdate },
    SavingsGoal,
    SavingsGoal[]
  >({
    cache: this.#api.cache,
    invalidateKeys: ({ id }) => [
      ['savings-goals', 'list'],
      // A status change (COMPLETED / ACTIVE) shifts the derived progression, so
      // refetch it — progress lives under a distinct key (prefix-based invalidation).
      ['savings-goals', 'progress', id],
    ],
    mutationFn: ({ id, updates }) =>
      this.#api.update$(id, updates).pipe(map((response) => response.data)),
    onMutate: ({ id, updates }) => {
      const previous = this.savingsGoals.value() ?? [];
      this.savingsGoals.update((data) =>
        (data ?? []).map((goal) =>
          goal.id === id ? { ...goal, ...updates } : goal,
        ),
      );
      return previous;
    },
    onError: (_err, _vars, previous) => {
      if (previous) this.savingsGoals.set(previous);
    },
  });

  readonly #deleteMutation = cachedMutation<
    string,
    void,
    { goals: SavingsGoal[]; selectedGoalId: string | null }
  >({
    cache: this.#api.cache,
    // The goal is gone — list, progress AND contributions are all stale, so
    // nuke the whole domain prefix (same shape as create).
    invalidateKeys: () => [['savings-goals']],
    mutationFn: (id) => this.#api.delete$(id).pipe(map(() => void 0 as void)),
    onMutate: (id) => {
      const snapshot = {
        goals: this.savingsGoals.value() ?? [],
        selectedGoalId: this.#selectedGoalId(),
      };
      this.#selectedGoalId.set(null);
      this.savingsGoals.update((data) =>
        (data ?? []).filter((goal) => goal.id !== id),
      );
      return snapshot;
    },
    onSuccess: () => {
      this.#budgetApi.cache.invalidate(['budget']);
      this.#budgetTemplatesApi.cache.invalidate(['templates']);
    },
    onError: (_err, _id, snapshot) => {
      if (!snapshot) return;
      this.savingsGoals.set(snapshot.goals);
      this.#selectedGoalId.set(snapshot.selectedGoalId);
    },
  });

  // Plan apply (PUL-12 simulateur) — pessimistic write. The server owns the
  // recomputed progression, so no optimistic patch: invalidate the whole domain
  // prefix (progress + list + contributions) and refetch progress.
  readonly #applyPlanMutation = cachedMutation<
    { goalId: string; plan: SavingsGoalPlanApply },
    SavingsGoalPlanApplyResponse['data'],
    void
  >({
    cache: this.#api.cache,
    invalidateKeys: () => [['savings-goals']],
    mutationFn: ({ goalId, plan }) =>
      this.#api.applyPlan$(goalId, plan).pipe(map((response) => response.data)),
    onSuccess: () => {
      this.#budgetApi.cache.invalidate(['budget']);
    },
    onError: () => {
      // Provisioning may have committed before the final amount RPC failed.
      this.#budgetApi.cache.invalidate(['budget']);
      this.#api.cache.invalidate(['savings-goals']);
    },
  });

  async applyPlan(
    goalId: string,
    plan: SavingsGoalPlanApply,
  ): Promise<SavingsGoalPlanApplyResponse['data']> {
    const result = await this.#applyPlanMutation.mutate({ goalId, plan });
    if (!result) {
      throw (
        this.#applyPlanMutation.error() ?? new Error('Failed to apply plan')
      );
    }
    this.reloadProgress();
    return result;
  }

  refresh(): void {
    this.savingsGoals.reload();
  }

  async addGoal(goal: SavingsGoalCreate): Promise<SavingsGoal> {
    const result = await this.#createMutation.mutate(goal);
    if (!result) {
      throw (
        this.#createMutation.error() ??
        new Error('Failed to create savings goal')
      );
    }
    // Settle the cache from the awaited return value (latest-wins gotcha).
    this.savingsGoals.update((data) => [...(data ?? []), result]);
    return result;
  }

  async editGoal(id: string, updates: SavingsGoalUpdate): Promise<SavingsGoal> {
    const result = await this.#updateMutation.mutate({ id, updates });
    if (!result) {
      throw (
        this.#updateMutation.error() ??
        new Error('Failed to update savings goal')
      );
    }
    this.savingsGoals.update((data) =>
      (data ?? []).map((goal) => (goal.id === id ? result : goal)),
    );
    return result;
  }

  /** D2 — mark an objective as reached (never auto-flipped; user confirms). */
  async completeGoal(id: string): Promise<SavingsGoal> {
    return this.editGoal(id, { status: 'COMPLETED' });
  }

  /** Re-open a COMPLETED objective (reversible transition). */
  async reopenGoal(id: string): Promise<SavingsGoal> {
    return this.editGoal(id, { status: 'ACTIVE' });
  }

  async removeGoal(id: string): Promise<void> {
    // delete resolves to `void`, so the return value cannot signal failure —
    // rely on the mutation status (onError already rolled back the optimistic
    // removal in onMutate).
    await this.#deleteMutation.mutate(id);
    if (this.#deleteMutation.status() === 'error') {
      throw (
        this.#deleteMutation.error() ??
        new Error('Failed to delete savings goal')
      );
    }
  }
}
