import { inject } from '@angular/core';
import {
  type HttpInterceptorFn,
  type HttpRequest,
  type HttpEvent,
  type HttpErrorResponse,
  type HttpHandlerFn,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { type Observable, throwError, from, switchMap, catchError } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { AuthStore } from './auth-store';
import { ApplicationConfiguration } from '../config/application-configuration';
import { ROUTES } from '../routing/routes-constants';
import { AUTH_ERROR_KEYS } from './auth-constants';

interface InterceptorContext {
  readonly req: HttpRequest<unknown>;
  readonly next: HttpHandlerFn;
  readonly session: AuthSessionService;
  readonly authStore: AuthStore;
  readonly router: Router;
  readonly transloco: TranslocoService;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(AuthSessionService);
  const authStore = inject(AuthStore);
  const applicationConfig = inject(ApplicationConfiguration);
  const router = inject(Router);
  const transloco = inject(TranslocoService);

  if (!shouldInterceptRequest(req.url, applicationConfig.backendApiUrl())) {
    return next(req);
  }

  const ctx: InterceptorContext = {
    req,
    next,
    session,
    authStore,
    router,
    transloco,
  };

  return next(addAuthToken(req, authStore)).pipe(
    catchError((error: HttpErrorResponse) => handleAuthError(error, ctx)),
  );
};

function shouldInterceptRequest(url: string, backendApiUrl: string): boolean {
  if (!backendApiUrl) return false;
  if (url.includes('/config.json')) return false;
  return url.startsWith(backendApiUrl);
}

function addAuthToken(
  req: HttpRequest<unknown>,
  authStore: AuthStore,
): HttpRequest<unknown> {
  const accessToken = authStore.session()?.access_token;
  if (!accessToken) return req;
  return req.clone({
    headers: req.headers.set('Authorization', `Bearer ${accessToken}`),
  });
}

function handleAuthError(
  error: HttpErrorResponse,
  ctx: InterceptorContext,
): Observable<HttpEvent<unknown>> {
  if (error.status === 401 && ctx.authStore.isAuthenticated()) {
    return from(ctx.session.refreshSession()).pipe(
      switchMap((refreshed) =>
        refreshed
          ? ctx.next(addAuthToken(ctx.req, ctx.authStore))
          : signOutAndRedirect(ctx, AUTH_ERROR_KEYS.SESSION_EXPIRED),
      ),
      catchError(() => signOutAndRedirect(ctx, AUTH_ERROR_KEYS.REFRESH_FAILED)),
    );
  }

  if (
    error.status === 403 &&
    error.error?.code === 'ERR_AUTH_CLIENT_KEY_MISSING'
  ) {
    if (
      ctx.router.url.includes(ROUTES.ENTER_VAULT_CODE) ||
      !ctx.authStore.isAuthenticated()
    ) {
      return throwError(() => error);
    }
    ctx.router.navigate(['/', ROUTES.ENTER_VAULT_CODE]);
    return throwError(
      () =>
        new Error(ctx.transloco.translate(AUTH_ERROR_KEYS.CLIENT_KEY_MISSING)),
    );
  }

  if (
    error.status === 403 &&
    (error.error?.code === 'ERR_USER_ACCOUNT_BLOCKED' ||
      error.error?.error === 'ERR_USER_ACCOUNT_BLOCKED')
  ) {
    return signOutAndRedirect(ctx, AUTH_ERROR_KEYS.ACCOUNT_BLOCKED);
  }

  return throwError(() => error);
}

function signOutAndRedirect(
  ctx: InterceptorContext,
  errorKey: string,
): Observable<never> {
  return from(ctx.session.signOut()).pipe(
    switchMap(() => from(ctx.router.navigate(['/', ROUTES.LOGIN]))),
    switchMap(() =>
      throwError(() => new Error(ctx.transloco.translate(errorKey))),
    ),
  );
}
