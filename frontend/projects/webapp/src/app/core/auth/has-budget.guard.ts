import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { firstValueFrom } from 'rxjs';
import { HasBudgetCache } from './has-budget-cache';

/**
 * Protects routes that require the user to have at least one budget.
 * Fast path: Uses cache (instant 90% of cases after pre-load at login).
 * Slow path: Fetches from API if cache miss (auto-syncs cache).
 * Fail-closed: Redirects to complete-profile on errors (secure default).
 */
export const hasBudgetGuard: CanActivateFn = async () => {
  const hasBudgetCache = inject(HasBudgetCache);
  const budgetApi = inject(BudgetApi);
  const router = inject(Router);
  const logger = inject(Logger);

  const redirectToCompleteProfile = () =>
    router.createUrlTree(['/', ROUTES.COMPLETE_PROFILE]);

  const hasBudgetFromCache = hasBudgetCache.hasBudget();

  // Fast path: cache hit (90% of cases after pre-load)
  if (hasBudgetFromCache !== null) {
    return hasBudgetFromCache ? true : redirectToCompleteProfile();
  }

  // Slow path: cache miss - fetch from API
  // Router automatically shows loading indicator during async operation
  try {
    const hasBudget = await firstValueFrom(budgetApi.checkBudgetExists$());
    return hasBudget ? true : redirectToCompleteProfile();
  } catch (error) {
    logger.error(
      'hasBudgetGuard: API error during cache miss, redirecting to complete-profile (fail-closed)',
      error,
    );
    return redirectToCompleteProfile();
  }
};
