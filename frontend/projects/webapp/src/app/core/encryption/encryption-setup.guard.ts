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

  const evaluate = (
    user: { user_metadata?: Record<string, unknown> } | null,
  ): boolean | ReturnType<Router['createUrlTree']> => {
    const hasVaultCode = !!user?.user_metadata?.['vaultCodeConfigured'];

    // Client key in memory AND user has vault code configured → allow
    if (clientKeyService.hasClientKey() && hasVaultCode) {
      return true;
    }

    // Stale key from different account → clear it
    if (clientKeyService.hasClientKey() && !hasVaultCode) {
      clientKeyService.clear();
    }

    return evaluateUser(user, router);
  };

  const currentState = authState.authState();
  if (!currentState.isLoading) {
    return evaluate(currentState.user);
  }

  return toObservable(authState.authState).pipe(
    filter((state) => !state.isLoading),
    take(1),
    map((state) => evaluate(state.user)),
  );
};

function evaluateUser(
  user: {
    user_metadata?: Record<string, unknown>;
  } | null,
  router: Router,
): boolean | ReturnType<Router['createUrlTree']> {
  if (user?.user_metadata?.['vaultCodeConfigured']) {
    return router.createUrlTree(['/', ROUTES.ENTER_VAULT_CODE]);
  }

  return router.createUrlTree(['/', ROUTES.SETUP_VAULT_CODE]);
}
