import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { firstValueFrom } from 'rxjs';

export const hasBudgetGuard: CanActivateFn = async () => {
  const budgetApi = inject(BudgetApi);
  const router = inject(Router);
  const logger = inject(Logger);

  const redirectToCompleteProfile = () =>
    router.createUrlTree(['/', ROUTES.COMPLETE_PROFILE]);

  const cached = budgetApi.getCachedBudgetExists();

  // Trust fresh data always; trust stale true (budgets don't disappear); revalidate stale false
  if (cached !== null && (cached.fresh || cached.data)) {
    return cached.data ? true : redirectToCompleteProfile();
  }

  try {
    const hasBudget = await firstValueFrom(budgetApi.checkBudgetExists$());
    return hasBudget ? true : redirectToCompleteProfile();
  } catch (error) {
    logger.error(
      'hasBudgetGuard: API error, redirecting to complete-profile (fail-closed)',
      error,
    );
    return redirectToCompleteProfile();
  }
};
