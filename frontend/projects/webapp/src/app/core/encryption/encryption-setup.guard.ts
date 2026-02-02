import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';

import { ClientKeyService } from './client-key.service';
import { AuthStateService } from '@core/auth/auth-state.service';
import { ROUTES } from '@core/routing/routes-constants';

export const encryptionSetupGuard: CanActivateFn = () => {
  const clientKeyService = inject(ClientKeyService);
  const authState = inject(AuthStateService);
  const router = inject(Router);

  if (clientKeyService.hasClientKey()) {
    return true;
  }

  const currentState = authState.authState();
  if (!currentState.isLoading) {
    return evaluateUser(currentState.user, router);
  }

  return toObservable(authState.authState).pipe(
    filter((state) => !state.isLoading),
    take(1),
    map((state) => evaluateUser(state.user, router)),
  );
};

function evaluateUser(
  user: {
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  } | null,
  router: Router,
): boolean | ReturnType<Router['createUrlTree']> {
  if (user?.app_metadata?.['provider'] !== 'google') {
    return true;
  }

  if (user?.user_metadata?.['vaultCodeConfigured']) {
    return router.createUrlTree(['/', ROUTES.ENTER_VAULT_CODE]);
  }

  return router.createUrlTree(['/', ROUTES.SETUP_VAULT_CODE]);
}
