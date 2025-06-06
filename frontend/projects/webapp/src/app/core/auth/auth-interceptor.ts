import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, from, switchMap, catchError } from 'rxjs';
import { AuthApi } from './auth-api';
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  readonly #authApi = inject(AuthApi);

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    // Vérifier si la requête va vers notre backend
    if (!this.shouldInterceptRequest(req.url)) {
      return next.handle(req);
    }

    // Obtenir le token actuel et l'ajouter à la requête
    return from(this.addAuthToken(req)).pipe(
      switchMap((authReq) => next.handle(authReq)),
      catchError((error) => this.handleAuthError(error, req, next)),
    );
  }

  private shouldInterceptRequest(url: string): boolean {
    return url.startsWith(environment.backendUrl);
  }

  private async addAuthToken(
    req: HttpRequest<unknown>,
  ): Promise<HttpRequest<unknown>> {
    const session = await this.#authApi.getCurrentSession();

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

  private handleAuthError(
    error: HttpErrorResponse,
    originalReq: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (error.status === 401 && this.#authApi.isAuthenticated) {
      // Token expiré, essayer de le rafraîchir
      return from(this.#authApi.refreshSession()).pipe(
        switchMap((refreshSuccess) => {
          if (refreshSuccess) {
            // Réessayer la requête avec le nouveau token
            return from(this.addAuthToken(originalReq)).pipe(
              switchMap((authReq) => next.handle(authReq)),
            );
          } else {
            // Impossible de rafraîchir, déconnecter l'utilisateur
            this.#authApi.signOut();
            return throwError(
              () => new Error('Session expirée, veuillez vous reconnecter'),
            );
          }
        }),
        catchError((refreshError) => {
          // Erreur lors du rafraîchissement
          this.#authApi.signOut();
          return throwError(() => refreshError);
        }),
      );
    }

    return throwError(() => error);
  }
}
