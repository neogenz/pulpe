import { Service, computed, inject, signal } from '@angular/core';
import {
  API_ERROR_CODES,
  type SavingsGoal,
  type SavingsGoalContribution,
  type SavingsGoalCreate,
  type SavingsGoalDeletionCommand,
  type SavingsGoalDeletionImpact,
  type SavingsGoalFutureLine,
  type SavingsGoalGenerationStop,
  type SavingsGoalPlanApply,
  type SavingsGoalPlanApplyResponse,
  type SavingsGoalProgress,
  type SavingsGoalUpdate,
  type SavingsGoalWithdrawal,
  type SavingsGoalPlannedWithdrawal,
  type SavingsGoalPlanOnlyWithdrawal,
  type SavingsGoalWithdrawalsResponse,
} from 'pulpe-shared';
import { firstValueFrom, map } from 'rxjs';
import { cachedResource, cachedMutation } from 'ngx-ziflux';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { isApiError } from '@core/api/api-error';

@Service({ autoProvided: false })
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
      this.#api.getProgress$(params.goalId).pipe(map((res) => res.data)),
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
      this.#api.getContributions$(params.goalId).pipe(map((res) => res.data)),
  });

  readonly contributions = computed<SavingsGoalContribution[]>(
    () => this.#contributionsResource.value() ?? [],
  );
  readonly isContributionsLoading =
    this.#contributionsResource.isInitialLoading;

  // Sorties d'argent (PUL-329) — chargées en parallèle de la progression et des
  // contributions, avec leurs propres états pour qu'une erreur ici n'emporte pas
  // le reste du détail.
  readonly #withdrawalsResource = cachedResource<
    SavingsGoalWithdrawalsResponse,
    { goalId: string }
  >({
    cache: this.#api.cache,
    cacheKey: (params) => ['savings-goals', 'withdrawals', params.goalId],
    params: () => {
      const id = this.#selectedGoalId();
      return id ? { goalId: id } : undefined;
    },
    loader: ({ params }) => this.#api.getWithdrawals$(params.goalId),
  });

  readonly withdrawals = computed<SavingsGoalWithdrawal[]>(
    () => this.#withdrawalsResource.value()?.data ?? [],
  );
  readonly plannedWithdrawals = computed<SavingsGoalPlannedWithdrawal[]>(
    () => this.#withdrawalsResource.value()?.planned ?? [],
  );
  readonly planOnlyWithdrawals = computed<SavingsGoalPlanOnlyWithdrawal[]>(
    () => this.#withdrawalsResource.value()?.planOnly ?? [],
  );
  readonly isWithdrawalsLoading = this.#withdrawalsResource.isInitialLoading;
  readonly withdrawalsError = this.#withdrawalsResource.error;

  reloadWithdrawals(): void {
    this.#withdrawalsResource.reload();
  }

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
    onSuccess: (_result, input) => {
      // Auto-décomposition (PUL-285/PUL-316) : le serveur a posé des
      // budget_lines one_off liées dans les budgets existants de l'horizon.
      if (input.monthlyContribution != null) {
        this.#budgetApi.cache.invalidate(['budget']);
        this.#budgetTemplatesApi.cache.invalidate(['templates']);
      }
    },
    onError: (error) => {
      if (
        !isApiError(error) ||
        error.code !==
          API_ERROR_CODES.SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED
      ) {
        return;
      }
      this.#api.cache.invalidate(['savings-goals']);
      this.#budgetApi.cache.invalidate(['budget']);
      this.#budgetTemplatesApi.cache.invalidate(['templates']);
    },
  });

  readonly #updateMutation = cachedMutation<
    { id: string; updates: SavingsGoalUpdate },
    SavingsGoal,
    SavingsGoal[]
  >({
    cache: this.#api.cache,
    invalidateKeys: ({ id, updates }) =>
      updates.reconciliation
        ? [['savings-goals']]
        : [
            ['savings-goals', 'list'],
            // A status change (COMPLETED / ACTIVE) shifts the derived
            // progression, so refetch its distinct cache key.
            ['savings-goals', 'progress', id],
          ],
    mutationFn: ({ id, updates }) =>
      this.#api.update$(id, updates).pipe(map((response) => response.data)),
    onMutate: ({ id, updates }) => {
      const previous = this.savingsGoals.value() ?? [];
      const optimisticUpdates = { ...updates };
      delete optimisticUpdates.reconciliation;
      this.savingsGoals.update((data) =>
        (data ?? []).map((goal) =>
          goal.id === id ? { ...goal, ...optimisticUpdates } : goal,
        ),
      );
      return previous;
    },
    onSuccess: (_result, { updates }) => {
      if (updates.reconciliation) {
        this.#budgetApi.cache.invalidate(['budget']);
      }
    },
    onError: (error, { updates }, previous) => {
      if (previous) this.savingsGoals.set(previous);
      if (
        updates.reconciliation &&
        isApiError(error) &&
        error.code ===
          API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_RECALCULATION_FAILED
      ) {
        this.#api.cache.invalidate(['savings-goals']);
        this.#budgetApi.cache.invalidate(['budget']);
      }
    },
  });

  // Arrêt de génération (PUL-285 CA5/CA8) — candidates advisory quand
  // l'objectif n'est pas ACTIVE : prévisions liées futures figeables/retirables.
  readonly #futureLinesResource = cachedResource<
    SavingsGoalFutureLine[],
    { goalId: string }
  >({
    cache: this.#api.cache,
    cacheKey: (params) => ['savings-goals', 'future-lines', params.goalId],
    params: () => {
      const goal = this.selectedGoal();
      return goal && goal.status !== 'ACTIVE' ? { goalId: goal.id } : undefined;
    },
    loader: ({ params }) =>
      this.#api
        .getFutureLines$(params.goalId)
        .pipe(map((res) => res.data ?? [])),
  });

  readonly futureLines = computed<SavingsGoalFutureLine[]>(
    () => this.#futureLinesResource.value() ?? [],
  );

  // Pessimistic: lines are frozen or DELETED server-side, atomically — no
  // optimistic patch; the domain prefix invalidation covers future-lines too.
  readonly #generationStopMutation = cachedMutation<
    { goalId: string; decision: SavingsGoalGenerationStop },
    { affectedCount: number },
    void
  >({
    cache: this.#api.cache,
    invalidateKeys: () => [['savings-goals']],
    mutationFn: ({ goalId, decision }) =>
      this.#api
        .applyGenerationStop$(goalId, decision)
        .pipe(map((response) => response.data)),
    onSuccess: () => {
      this.#budgetApi.cache.invalidate(['budget']);
    },
    onError: () => {
      // Un 409/422 signifie que les candidates ont drifté (pointage, cycle) —
      // la RPC est atomique (rien d'écrit) mais les caches de lecture sont
      // périmés : même règle « succès ET erreur » que #applyPlanMutation.
      this.#budgetApi.cache.invalidate(['budget']);
      this.#api.cache.invalidate(['savings-goals']);
    },
  });

  /**
   * Fresh advisory list for a post-transition prompt. Writes the result into
   * the resource's cache key so the re-entry card and the dialog share one
   * server truth instead of issuing parallel GETs.
   */
  async fetchFutureLines(
    goalId: string,
    targetDate?: string,
  ): Promise<SavingsGoalFutureLine[]> {
    const lines = await firstValueFrom(
      this.#api
        .getFutureLines$(goalId, targetDate)
        .pipe(map((res) => res.data ?? [])),
    );
    if (targetDate === undefined) {
      this.#api.cache.set(['savings-goals', 'future-lines', goalId], lines);
    }
    return lines;
  }

  async applyGenerationStop(
    goalId: string,
    decision: SavingsGoalGenerationStop,
  ): Promise<{ affectedCount: number }> {
    const result = await this.#generationStopMutation.mutate({
      goalId,
      decision,
    });
    if (!result) {
      throw (
        this.#generationStopMutation.error() ??
        new Error('Failed to apply the generation-stop decision')
      );
    }
    this.reloadProgress();
    return result;
  }

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

  async fetchDeletionImpact(id: string): Promise<SavingsGoalDeletionImpact> {
    return firstValueFrom(
      this.#api.getDeletionImpact$(id).pipe(map((response) => response.data)),
    );
  }

  async deleteGoal(
    id: string,
    command: SavingsGoalDeletionCommand,
  ): Promise<void> {
    try {
      await firstValueFrom(this.#api.applyDeletion$(id, command));
    } catch (error) {
      if (
        isApiError(error) &&
        error.code === API_ERROR_CODES.SAVINGS_GOAL_NOT_FOUND
      ) {
        this.#settleCommittedDeletion(id);
        return;
      }
      if (
        isApiError(error) &&
        error.code ===
          API_ERROR_CODES.SAVINGS_GOAL_DELETION_RECALCULATION_FAILED
      ) {
        this.#settleCommittedDeletion(id);
      }
      throw error;
    }
    this.#settleCommittedDeletion(id);
  }

  #settleCommittedDeletion(id: string): void {
    if (this.#selectedGoalId() === id) this.#selectedGoalId.set(null);
    this.savingsGoals.update((data) =>
      (data ?? []).filter((goal) => goal.id !== id),
    );
    this.#api.cache.invalidate(['savings-goals']);
    this.#budgetApi.cache.invalidate(['budget']);
    this.#budgetTemplatesApi.cache.invalidate(['templates']);
  }
}
