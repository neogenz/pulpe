import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { type Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap, take } from 'rxjs/operators';

import { ClientKeyService } from './client-key.service';
import { EncryptionApi } from './encryption-api';
import { AuthStateService } from '@core/auth/auth-state.service';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { ROUTES } from '@core/routing/routes-constants';

export const encryptionSetupGuard: CanActivateFn = () => {
  const clientKeyService = inject(ClientKeyService);
  const authState = inject(AuthStateService);
  const demoModeService = inject(DemoModeService);
  const encryptionApi = inject(EncryptionApi);
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
  ): boolean | UrlTree => {
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

  // Validate stale localStorage keys against the server before granting access.
  // Prevents data corruption when vault code was changed on another device.
  const ensureKeyValid = (
    result: boolean | UrlTree,
  ): Observable<boolean | UrlTree> => {
    if (result !== true || !clientKeyService.needsServerValidation()) {
      return of(result);
    }

    const clientKeyHex = clientKeyService.clientKeyHex();
    if (!clientKeyHex) {
      return of(router.createUrlTree(['/', ROUTES.ENTER_VAULT_CODE]));
    }

    return encryptionApi.validateKey$(clientKeyHex).pipe(
      map(() => {
        clientKeyService.markValidated();
        return true as const;
      }),
      catchError(() => {
        clientKeyService.clear();
        return of(router.createUrlTree(['/', ROUTES.ENTER_VAULT_CODE]));
      }),
    );
  };

  const currentState = authState.authState();
  if (!currentState.isLoading) {
    return ensureKeyValid(evaluate(currentState.user));
  }

  return toObservable(authState.authState).pipe(
    filter((state) => !state.isLoading),
    take(1),
    switchMap((state) => ensureKeyValid(evaluate(state.user))),
  );
};

function evaluateUser(
  user: {
    user_metadata?: Record<string, unknown>;
  } | null,
  router: Router,
): UrlTree {
  if (user?.user_metadata?.['vaultCodeConfigured']) {
    return router.createUrlTree(['/', ROUTES.ENTER_VAULT_CODE]);
  }

  return router.createUrlTree(['/', ROUTES.SETUP_VAULT_CODE]);
}
