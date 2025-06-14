import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';

import { AuthApi } from './auth-api';
import { ROUTES } from '@core/routing/routes-constants';

/**
 * Prevents authenticated users from accessing routes.
 *
 * This guard is intended for public-only pages like login or registration.
 * If the user is authenticated, it redirects them to the main application page.
 * It reactively waits for the authentication state to be resolved before making a decision.
 */
export const publicGuard: CanActivateFn = () => {
  const authApi = inject(AuthApi);
  const router = inject(Router);

  return toObservable(authApi.authState).pipe(
    filter((state) => !state.isLoading),
    take(1),
    map((state) => {
      if (state.isAuthenticated) {
        router.navigate([ROUTES.CURRENT_MONTH]).catch((error) => {
          console.error(
            'Navigation to the main application page failed, redirecting to onboarding.',
            error,
          );
          router.navigate([ROUTES.ONBOARDING]);
        });
        return false;
      }

      return true;
    }),
  );
};
