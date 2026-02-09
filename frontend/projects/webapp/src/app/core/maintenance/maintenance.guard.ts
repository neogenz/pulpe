import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Logger } from '../logging/logger';
import { ROUTES } from '../routing/routes-constants';
import { MaintenanceApi } from './maintenance-api';

/**
 * Guard that checks if the application is in maintenance mode.
 * Waits for the server response (no client-side timeout).
 * Uses fail-open on network errors: the maintenanceInterceptor catches 503s as backup.
 */
export const maintenanceGuard: CanActivateFn = async () => {
  const logger = inject(Logger);
  const maintenanceApi = inject(MaintenanceApi);

  // Skip check if already on maintenance page to prevent loops
  if (window.location.pathname.startsWith('/' + ROUTES.MAINTENANCE)) {
    return true;
  }

  try {
    const data = await maintenanceApi.checkStatus();
    if (data.maintenanceMode) {
      logger.info('Maintenance mode active, redirecting...');
      window.location.href = '/' + ROUTES.MAINTENANCE;
      return false;
    }
    return true;
  } catch (error) {
    // Fail-open: allow access on network/CORS errors. maintenanceInterceptor handles 503s.
    logger.warn('Maintenance status check failed, allowing access', { error });
    return true;
  }
};
