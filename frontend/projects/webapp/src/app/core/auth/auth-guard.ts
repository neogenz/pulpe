import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { ROUTES } from '@core/routing/routes-constants';
import { AuthStateService } from './auth-state.service';

/**
 * Protects routes from unauthenticated access.
 *
 * This guard is intended for private pages that require a logged-in user.
 * If the user is not authenticated, it redirects them to the login page.
 *
 * Optimized for zoneless: reads signal synchronously when auth state is already resolved,
 * only falls back to async observable for initial load (refresh, direct URL access).
 */
export const authGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  // SYNC: If auth is already resolved, return immediately (intra-app navigation)
  const currentState = authState.authState();
  if (!currentState.isLoading) {
    return currentState.isAuthenticated
      ? true
      : router.createUrlTree([ROUTES.LOGIN]);
  }

  // ASYNC: Only for initial load when auth state is still loading
  return toObservable(authState.authState).pipe(
    filter((state) => !state.isLoading),
    take(1),
    map((state) =>
      state.isAuthenticated ? true : router.createUrlTree([ROUTES.LOGIN]),
    ),
  );
};
