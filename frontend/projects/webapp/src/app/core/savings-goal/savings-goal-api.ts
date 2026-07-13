import { effect, inject, Injectable, untracked } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  type SavingsGoalCreate,
  savingsGoalCreateSchema,
  type SavingsGoalListResponse,
  savingsGoalListResponseSchema,
  type SavingsGoalProgressResponse,
  savingsGoalProgressResponseSchema,
  type SavingsGoalResponse,
  savingsGoalResponseSchema,
  type SavingsGoalDeleteResponse,
  savingsGoalDeleteResponseSchema,
  type SavingsGoalContributionsResponse,
  savingsGoalContributionsResponseSchema,
  type SavingsGoalUpdate,
  savingsGoalUpdateSchema,
  type SavingsGoalPlanApply,
  savingsGoalPlanApplySchema,
  type SavingsGoalPlanApplyResponse,
  savingsGoalPlanApplyResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';
import { BudgetApi } from '@core/budget/budget-api';
import { DataCache } from 'ngx-ziflux';

@Injectable({
  providedIn: 'root',
})
export class SavingsGoalApi {
  readonly #api = inject(ApiClient);
  readonly #budgetApi = inject(BudgetApi);
  readonly cache = new DataCache({
    name: 'savings-goals',
    staleTime: 30_000,
    expireTime: 300_000,
  });

  constructor() {
    // Goal progress is computed server-side from budget lines + transactions.
    // Any budget-domain mutation (transaction pointée, ligne modifiée…) must
    // mark progress stale, otherwise the goal detail serves the pre-mutation
    // confirmed amount for up to staleTime.
    effect(() => {
      if (this.#budgetApi.cache.version() === 0) return;
      untracked(() => {
        this.cache.invalidate(['savings-goals', 'progress']);
        this.cache.invalidate(['savings-goals', 'contributions']);
      });
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getAll$(): Observable<SavingsGoalListResponse> {
    return this.#api.get$('/savings-goals', savingsGoalListResponseSchema);
  }

  getProgress$(id: string): Observable<SavingsGoalProgressResponse> {
    return this.#api.get$(
      `/savings-goals/${id}/progress`,
      savingsGoalProgressResponseSchema,
    );
  }

  getContributions$(id: string): Observable<SavingsGoalContributionsResponse> {
    return this.#api.get$(
      `/savings-goals/${id}/contributions`,
      savingsGoalContributionsResponseSchema,
    );
  }

  create$(goal: SavingsGoalCreate): Observable<SavingsGoalResponse> {
    return this.#api.post$(
      '/savings-goals',
      goal,
      savingsGoalResponseSchema,
      savingsGoalCreateSchema,
    );
  }

  update$(
    id: string,
    updates: SavingsGoalUpdate,
  ): Observable<SavingsGoalResponse> {
    return this.#api.patch$(
      `/savings-goals/${id}`,
      updates,
      savingsGoalResponseSchema,
      savingsGoalUpdateSchema,
    );
  }

  delete$(id: string): Observable<SavingsGoalDeleteResponse> {
    return this.#api.delete$(
      `/savings-goals/${id}`,
      savingsGoalDeleteResponseSchema,
    );
  }

  /**
   * Applies a simulated plan (`POST /savings-goals/:id/plan`). Amount-only,
   * pessimistic write — the server recomputes the progression. Touches budget
   * lines across several months. Cache settlement belongs to the caller's
   * mutation because provisioning may commit before a later RPC failure.
   */
  applyPlan$(
    id: string,
    plan: SavingsGoalPlanApply,
  ): Observable<SavingsGoalPlanApplyResponse> {
    return this.#api.post$(
      `/savings-goals/${id}/plan`,
      plan,
      savingsGoalPlanApplyResponseSchema,
      savingsGoalPlanApplySchema,
    );
  }
}
