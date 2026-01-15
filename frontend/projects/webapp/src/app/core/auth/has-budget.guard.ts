import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { HasBudgetCache } from './has-budget-cache';

/**
 * Protects routes that require the user to have at least one budget.
 * Fast path: Uses cache (instant 90% of cases after pre-load at login).
 * Slow path: Fetches from API if cache miss (auto-syncs cache).
 * Fail-safe: Allows navigation on network errors.
 */
export const hasBudgetGuard: CanActivateFn = async () => {
  const hasBudgetCache = inject(HasBudgetCache);
  const budgetApi = inject(BudgetApi);
  const router = inject(Router);
  const logger = inject(Logger);

  const redirectToCompleteProfile = () =>
    router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);

  const cached = hasBudgetCache.get();

  // Fast path: cache hit (90% of cases after pre-load)
  if (cached !== null) {
    return cached ? true : redirectToCompleteProfile();
  }

  // Slow path: cache miss - fetch from API
  // Router automatically shows loading indicator during async operation
  try {
    const hasBudget = await firstValueFrom(budgetApi.checkBudgetExists$());
    return hasBudget ? true : redirectToCompleteProfile();
  } catch (error) {
    logger.warn(
      'hasBudgetGuard: API error during cache miss, allowing navigation (fail-safe)',
      error,
    );
    return true;
  }
};
