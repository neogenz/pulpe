import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Logger } from '../logging/logger';
import { ROUTES } from '../routing/routes-constants';
import { MaintenanceApi } from './maintenance-api';

/**
 * Guard that checks if the application is in maintenance mode.
 * Waits for the server response (no client-side timeout).
 * Uses fail-closed on network errors to prevent bypassing maintenance.
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
    // If status check fails or network error: assume maintenance (fail-closed)
    logger.warn('Maintenance status check failed, redirecting to maintenance', {
      error,
    });
    window.location.href = '/' + ROUTES.MAINTENANCE;
    return false;
  }
};
