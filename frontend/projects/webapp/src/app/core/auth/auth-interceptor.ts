import { inject } from '@angular/core';
import {
  type HttpInterceptorFn,
  type HttpRequest,
  type HttpEvent,
  type HttpErrorResponse,
} from '@angular/common/http';
import { type Observable, throwError, from, switchMap, catchError } from 'rxjs';
import { AuthApi } from './auth-api';
import { ApplicationConfiguration } from '../config/application-configuration';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next,
): Observable<HttpEvent<unknown>> => {
  const authApi = inject(AuthApi);
  const applicationConfig = inject(ApplicationConfiguration);

  // Vérifier si la requête va vers notre backend
  if (!shouldInterceptRequest(req.url, applicationConfig.backendApiUrl())) {
    return next(req);
  }

  // Obtenir le token actuel et l'ajouter à la requête
  return from(addAuthToken(req, authApi)).pipe(
    switchMap((authReq) => next(authReq)),
    catchError((error) => handleAuthError(error, req, next, authApi)),
  );
};

function shouldInterceptRequest(url: string, backendApiUrl: string): boolean {
  // Exclure les requêtes de configuration pour éviter la dépendance circulaire
  if (url.includes('/config.json') || url.includes('/config.local.json')) {
    return false;
  }

  return url.startsWith(backendApiUrl);
}

async function addAuthToken(
  req: HttpRequest<unknown>,
  authApi: AuthApi,
): Promise<HttpRequest<unknown>> {
  const session = await authApi.getCurrentSession();

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
  authApi: AuthApi,
): Observable<HttpEvent<unknown>> {
  // Only attempt refresh if it's a 401 and user is authenticated
  if (error.status === 401 && authApi.isAuthenticated()) {
    // Convert the refresh promise to an observable and handle the flow
    return from(authApi.refreshSession()).pipe(
      switchMap((refreshSuccess) => {
        if (!refreshSuccess) {
          // Refresh failed, sign out and throw error
          authApi.signOut();
          return throwError(
            () => new Error('Session expirée, veuillez vous reconnecter'),
          );
        }

        // Refresh succeeded, retry the original request with new token
        return from(addAuthToken(originalReq, authApi)).pipe(
          switchMap((authReq) => next(authReq)),
        );
      }),
      catchError((refreshError) => {
        // Error during refresh attempt
        authApi.signOut();
        return throwError(() => refreshError);
      }),
    );
  }

  // Not a 401 or user not authenticated, just pass the error through
  return throwError(() => error);
}
