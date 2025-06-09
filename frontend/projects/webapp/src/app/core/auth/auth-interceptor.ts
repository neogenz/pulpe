import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, from, switchMap, catchError } from 'rxjs';
import { AuthApi } from './auth-api';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next,
): Observable<HttpEvent<unknown>> => {
  const authApi = inject(AuthApi);

  alert('intercept');

  // Vérifier si la requête va vers notre backend
  if (!shouldInterceptRequest(req.url)) {
    return next(req);
  }

  // Obtenir le token actuel et l'ajouter à la requête
  return from(addAuthToken(req, authApi)).pipe(
    switchMap((authReq) => next(authReq)),
    catchError((error) => handleAuthError(error, req, next, authApi)),
  );
};

function shouldInterceptRequest(url: string): boolean {
  return url.startsWith(environment.backendUrl);
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
  if (error.status === 401 && authApi.isAuthenticated()) {
    // Token expiré, essayer de le rafraîchir
    return from(authApi.refreshSession()).pipe(
      switchMap((refreshSuccess) => {
        if (refreshSuccess) {
          // Réessayer la requête avec le nouveau token
          return from(addAuthToken(originalReq, authApi)).pipe(
            switchMap((authReq) => next(authReq)),
          );
        } else {
          // Impossible de rafraîchir, déconnecter l'utilisateur
          authApi.signOut();
          return throwError(
            () => new Error('Session expirée, veuillez vous reconnecter'),
          );
        }
      }),
      catchError((refreshError) => {
        // Erreur lors du rafraîchissement
        authApi.signOut();
        return throwError(() => refreshError);
      }),
    );
  }

  return throwError(() => error);
}
