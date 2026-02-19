import { inject } from '@angular/core';
import {
  type HttpInterceptorFn,
  type HttpRequest,
  type HttpEvent,
  type HttpErrorResponse,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { type Observable, throwError, from, switchMap, catchError } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { AuthStateService } from './auth-state.service';
import { ClientKeyService } from '../encryption';
import { ApplicationConfiguration } from '../config/application-configuration';
import { ROUTES } from '../routing/routes-constants';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next,
): Observable<HttpEvent<unknown>> => {
  const authSession = inject(AuthSessionService);
  const authState = inject(AuthStateService);
  const clientKeyService = inject(ClientKeyService);
  const applicationConfig = inject(ApplicationConfiguration);
  const router = inject(Router);

  // Vérifier si la requête va vers notre backend
  if (!shouldInterceptRequest(req.url, applicationConfig.backendApiUrl())) {
    return next(req);
  }

  // Obtenir le token actuel et l'ajouter à la requête
  return from(addAuthToken(req, authSession)).pipe(
    switchMap((authReq) => next(authReq)),
    catchError((error) =>
      handleAuthError(
        error,
        req,
        next,
        authSession,
        authState,
        clientKeyService,
        router,
      ),
    ),
  );
};

function shouldInterceptRequest(url: string, backendApiUrl: string): boolean {
  // Exclure les requêtes de configuration pour éviter la dépendance circulaire
  if (url.includes('/config.json')) {
    return false;
  }

  return url.startsWith(backendApiUrl);
}

async function addAuthToken(
  req: HttpRequest<unknown>,
  authSession: AuthSessionService,
): Promise<HttpRequest<unknown>> {
  const session = await authSession.getCurrentSession();

  if (session?.access_token) {
    return req.clone({
      headers: req.headers.set(
        'Authorization',
        `Bearer ${session.access_token}`,
      ),
    });
  }

  return req;
}

function handleAuthError(
  error: HttpErrorResponse,
  originalReq: HttpRequest<unknown>,
  next: (req: HttpRequest<unknown>) => Observable<HttpEvent<unknown>>,
  authSession: AuthSessionService,
  authState: AuthStateService,
  clientKeyService: ClientKeyService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  // Only attempt refresh if it's a 401 and user is authenticated
  if (error.status === 401 && authState.isAuthenticated()) {
    return from(authSession.refreshSession()).pipe(
      switchMap((refreshSuccess) => {
        if (!refreshSuccess) {
          authSession.signOut();
          router.navigate(['/', ROUTES.LOGIN]);
          return throwError(
            () => new Error('Session expirée, veuillez vous reconnecter'),
          );
        }

        // Refresh succeeded, retry the original request with new token
        return from(addAuthToken(originalReq, authSession)).pipe(
          switchMap((authReq) => next(authReq)),
        );
      }),
      catchError((refreshError) => {
        authSession.signOut();
        router.navigate(['/', ROUTES.LOGIN]);
        return throwError(() => refreshError);
      }),
    );
  }

  // Handle missing client encryption key — redirect to vault code entry,
  // NOT signOut. The Supabase session is still valid; only the client key
  // was lost (e.g. sessionStorage cleared after background inactivity).
  if (
    error.status === 403 &&
    error.error?.code === 'ERR_AUTH_CLIENT_KEY_MISSING'
  ) {
    router.navigate(['/', ROUTES.ENTER_VAULT_CODE]);
    return throwError(() => new Error('Client encryption key missing'));
  }

  // The original request is not retried after re-entering the vault code.
  if (
    error.status === 400 &&
    error.error?.code === 'ERR_ENCRYPTION_KEY_CHECK_FAILED'
  ) {
    clientKeyService.clear();
    router.navigate(['/', ROUTES.ENTER_VAULT_CODE]);
    return throwError(
      () => new Error('Client encryption key verification failed'),
    );
  }

  // Handle account blocked (scheduled for deletion)
  if (
    error.status === 403 &&
    (error.error?.code === 'ERR_USER_ACCOUNT_BLOCKED' ||
      error.error?.error === 'ERR_USER_ACCOUNT_BLOCKED')
  ) {
    authSession.signOut();
    router.navigate(['/', ROUTES.LOGIN]);
    return throwError(
      () => new Error('Ton compte est en cours de suppression.'),
    );
  }

  // Not a 401/403 or user not authenticated, just pass the error through
  return throwError(() => error);
}
