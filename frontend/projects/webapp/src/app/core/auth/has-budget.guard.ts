import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BudgetApi } from '@core/budget';
import { ROUTES } from '@core/routing/routes-constants';

/**
 * Guard that checks if the user has at least one budget.
 * If not, redirects to complete-profile page to create initial budget.
 *
 * This guard is intended to be used after authGuard on protected routes.
 * It ensures OAuth users who bypassed onboarding complete their profile setup.
 */
export const hasBudgetGuard: CanActivateFn = async () => {
  const budgetApi = inject(BudgetApi);
  const router = inject(Router);

  try {
    const budgets = await firstValueFrom(budgetApi.getAllBudgets$());

    if (budgets.length === 0) {
      // User has no budgets - redirect to complete profile
      return router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);
    }

    return true;
  } catch {
    // On error, allow navigation (don't block user)
    // The actual page will handle any API errors
    return true;
  }
};
