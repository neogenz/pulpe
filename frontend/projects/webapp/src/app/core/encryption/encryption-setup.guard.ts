import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';

import { ClientKeyService } from './client-key.service';
import { AuthStateService } from '@core/auth/auth-state.service';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { ROUTES } from '@core/routing/routes-constants';

export const encryptionSetupGuard: CanActivateFn = () => {
  const clientKeyService = inject(ClientKeyService);
  const authState = inject(AuthStateService);
  const demoModeService = inject(DemoModeService);
  const router = inject(Router);

  // Demo mode bypasses vault code setup - demo data is ephemeral and public
  if (demoModeService.isDemoMode()) {
    return true;
  }

  const evaluate = (
    user: {
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    } | null,
  ): boolean | ReturnType<Router['createUrlTree']> => {
    const hasClientKey = clientKeyService.hasClientKey();
    const hasVaultCode = !!user?.user_metadata?.['vaultCodeConfigured'];
    const provider = user?.app_metadata?.['provider'];
    const isEmailMigrationUser = !hasVaultCode && provider === 'email';

    // Client key in memory AND user has vault code configured → allow
    if (hasClientKey && hasVaultCode) {
      return true;
    }

    // Keep the legacy password-derived key for email users during vault setup.
    // For all other users without vault code, treat it as stale key material.
    if (hasClientKey && !isEmailMigrationUser) {
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
