import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { type CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, retry, timer } from 'rxjs';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { HasBudgetState } from './has-budget-state';

export const hasBudgetGuard: CanActivateFn = async () => {
  const budgetApi = inject(BudgetApi);
  const router = inject(Router);
  const logger = inject(Logger);
  const hasBudgetState = inject(HasBudgetState);

  // Use cached result if available (avoids API call on every navigation)
  const cached = hasBudgetState.get();
  if (cached === true) {
    return true;
  }
  if (cached === false) {
    return router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);
  }

  // No cache - fetch from API
  try {
    const budgets = await firstValueFrom(
      budgetApi
        .getAllBudgets$()
        .pipe(retry({ count: 2, delay: () => timer(1000) })),
    );

    if (budgets.length === 0) {
      hasBudgetState.setNoBudget();
      return router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);
    }

    hasBudgetState.setHasBudget();
    return true;
  } catch (error) {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0 || error.status >= 500) {
        logger.warn(
          'hasBudgetGuard: Network or server error, allowing navigation',
          { status: error.status },
        );
        return true;
      }
    }

    return router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);
  }
};
