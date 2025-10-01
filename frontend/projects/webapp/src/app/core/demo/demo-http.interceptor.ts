import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { DemoModeService } from './demo-mode.service';
import { DemoRequestRouter } from './demo-request-router';
import { ApplicationConfiguration } from '../config/application-configuration';

/**
 * HTTP interceptor for demo mode
 * Intercepts all requests to /api/v1/* and routes them to DemoStorageAdapter
 *
 * ADVANTAGES:
 * - Zero modifications to API services
 * - Single point of control
 * - Easy to enable/disable
 *
 * DISADVANTAGES:
 * - More complex debugging (requests intercepted invisibly)
 * - Requires URL parsing
 */
export const demoHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const demoMode = inject(DemoModeService);
  const demoRouter = inject(DemoRequestRouter);
  const config = inject(ApplicationConfiguration);

  // If not in demo mode, let the request pass through
  if (!demoMode.isDemoMode()) {
    return next(req);
  }

  // Check if this is an API request by comparing with backend URL
  const backendUrl = config.backendApiUrl();
  if (!req.url.startsWith(backendUrl)) {
    return next(req);
  }

  // Route the request to the simulator
  return demoRouter.handleRequest(req);
};
