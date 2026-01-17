import type {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, EMPTY, throwError } from 'rxjs';
import { Logger } from '../logging/logger';
import { ROUTES } from '../routing/routes-constants';

export const maintenanceInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(Logger);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 503 && error.error?.code === 'MAINTENANCE') {
        if (window.location.pathname.startsWith('/' + ROUTES.MAINTENANCE)) {
          return EMPTY;
        }
        logger.info('Maintenance mode detected, redirecting...');
        window.location.href = '/' + ROUTES.MAINTENANCE;
        return EMPTY;
      }
      return throwError(() => error);
    }),
  );
};
