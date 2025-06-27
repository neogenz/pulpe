import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { ROUTES } from '@core/routing/routes-constants';
import { AuthApi } from './auth-api';

/**
 * Protects routes from unauthenticated access.
 *
 * This guard is intended for private pages that require a logged-in user.
 * If the user is not authenticated, it redirects them to the login page.
 * It reactively waits for the authentication state to be resolved before making a decision.
 */
export const authGuard: CanActivateFn = () => {
  const authApi = inject(AuthApi);
  const router = inject(Router);

  if (authApi.isAuthenticated()) {
    return true;
  }

  // If immediately known to be unauthenticated, redirect to onboarding
  const currentState = authApi.authState();
  if (!currentState.isLoading && !currentState.isAuthenticated) {
    return router.createUrlTree([ROUTES.ONBOARDING]);
  }

  // Handle case where auth state is still loading
  return toObservable(authApi.authState).pipe(
    filter((state) => !state.isLoading),
    take(1),
    map((state) => {
      if (state.isAuthenticated) {
        return true;
      }
      return router.createUrlTree([ROUTES.ONBOARDING]);
    }),
  );
};
