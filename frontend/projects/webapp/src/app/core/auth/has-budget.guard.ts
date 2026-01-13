import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { type CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, retry, timer } from 'rxjs';
import { BudgetApi } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';

export const hasBudgetGuard: CanActivateFn = async () => {
  const budgetApi = inject(BudgetApi);
  const router = inject(Router);
  const logger = inject(Logger);

  try {
    const budgets = await firstValueFrom(
      budgetApi
        .getAllBudgets$()
        .pipe(retry({ count: 2, delay: () => timer(1000) })),
    );

    if (budgets.length === 0) {
      return router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);
    }

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
