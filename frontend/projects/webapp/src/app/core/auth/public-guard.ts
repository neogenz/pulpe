import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';

import { AuthStateService } from './auth-state.service';
import { ROUTES } from '@core/routing/routes-constants';

/**
 * Prevents authenticated users from accessing routes.
 *
 * This guard is intended for public-only pages like login or registration.
 * If the user is authenticated, it redirects them to the dashboard.
 * Child route guards (hasBudgetGuard) will handle further routing decisions.
 */
export const publicGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  return toObservable(authState.authState).pipe(
    filter((state) => !state.isLoading),
    take(1),
    map((state) => {
      if (state.isAuthenticated) {
        return router.createUrlTree(['/', ROUTES.DASHBOARD]);
      }
      return true;
    }),
  );
};
