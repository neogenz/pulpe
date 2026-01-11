import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { ROUTES } from '@core/routing/routes-constants';
import { AuthApi } from './auth-api';

/**
 * Protects routes from unauthenticated access.
 *
 * This guard is intended for private pages that require a logged-in user.
 * If the user is not authenticated, it redirects them to the welcome page.
 * It reactively waits for the authentication state to be resolved before making a decision.
 */
export const authGuard: CanActivateFn = () => {
  const authApi = inject(AuthApi);
  const router = inject(Router);

  // Reactive approach: wait for auth state to be determined
  return toObservable(authApi.authState).pipe(
    filter((state) => !state.isLoading), // Wait until loading is complete
    take(1), // Take only the first non-loading state
    map((state) => {
      if (state.isAuthenticated) {
        return true; // Allow navigation
      }
      // Redirect to welcome for unauthenticated users
      return router.createUrlTree([ROUTES.WELCOME]);
    }),
  );
};
