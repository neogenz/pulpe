import type {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';
import { ApplicationConfiguration } from '../config/application-configuration';

/**
 * HTTP error interceptor that captures HTTP errors and forwards them to PostHog
 * for comprehensive API error monitoring and debugging.
 *
 * Features:
 * - Captures all HTTP errors (4xx and 5xx responses)
 * - Provides detailed request and response context
 * - Sanitizes sensitive data before forwarding
 * - Respects environment and PostHog availability
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const postHogService = inject(PostHogService);
  const logger = inject(Logger);
  const applicationConfiguration = inject(ApplicationConfiguration);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Capture HTTP errors for monitoring
      captureHttpError(
        error,
        req.method,
        postHogService,
        logger,
        applicationConfiguration,
      );

      // Re-throw the error so it can be handled by the application
      return throwError(() => error);
    }),
  );
};

/**
 * Capture HTTP error details and forward to PostHog if available
 */
function captureHttpError(
  error: HttpErrorResponse,
  requestMethod: string,
  postHogService: PostHogService,
  logger: Logger,
  applicationConfiguration: ApplicationConfiguration,
): void {
  try {
    // Only capture in production or if explicitly enabled
    if (
      !applicationConfiguration.isProduction() &&
      !applicationConfiguration.isDevelopment()
    ) {
      return;
    }

    // Check if PostHog is available and initialized
    if (!postHogService.isInitialized() || !postHogService.isEnabled()) {
      return;
    }

    const errorContext = buildHttpErrorContext(error, requestMethod);

    // Log for development debugging
    if (applicationConfiguration.isDevelopment()) {
      logger.debug('HTTP Error captured for PostHog', errorContext);
    }

    // Determine event name based on error status
    const eventName = getHttpErrorEventName(error.status);

    // Capture the error event
    postHogService.capture(eventName, errorContext);
  } catch (captureError) {
    // Silently fail to avoid breaking the application
    logger.debug('Failed to capture HTTP error to PostHog', captureError);
  }
}

/**
 * Build comprehensive context object for HTTP errors
 */
function buildHttpErrorContext(
  error: HttpErrorResponse,
  requestMethod: string,
): Record<string, unknown> {
  return {
    // Error details
    status: error.status,
    statusText: error.statusText,

    // Request details
    method: requestMethod,
    url: sanitizeUrl(error.url || 'unknown'),

    // Response details
    errorMessage: extractErrorMessage(error),
    errorType: error.name,

    // Timing
    timestamp: new Date().toISOString(),

    // Context
    userAgent: navigator.userAgent,
    currentUrl: window.location.href,

    // Additional metadata
    isTimeoutError: error.status === 0,
    isNetworkError: error.status === 0 && !error.statusText,
    isServerError: error.status >= 500,
    isClientError: error.status >= 400 && error.status < 500,

    // Response size (if available)
    ...(error.headers.has('content-length') && {
      responseSize: error.headers.get('content-length'),
    }),
  };
}

/**
 * Extract meaningful error message from HTTP error response
 */
function extractErrorMessage(error: HttpErrorResponse): string {
  // Try to extract message from error response body
  if (error.error && typeof error.error === 'object') {
    if ('message' in error.error && typeof error.error.message === 'string') {
      return error.error.message;
    }

    if ('error' in error.error && typeof error.error.error === 'string') {
      return error.error.error;
    }

    if ('detail' in error.error && typeof error.error.detail === 'string') {
      return error.error.detail;
    }
  }

  // Fallback to error body as string
  if (typeof error.error === 'string') {
    return error.error.length > 200
      ? error.error.substring(0, 200) + '...'
      : error.error;
  }

  // Final fallback to status text or generic message
  return error.statusText || `HTTP ${error.status} Error`;
}

/**
 * Get appropriate event name based on HTTP status code
 */
function getHttpErrorEventName(status: number): string {
  if (status >= 500) {
    return 'http_server_error';
  }

  if (status >= 400) {
    return 'http_client_error';
  }

  if (status === 0) {
    return 'http_network_error';
  }

  return 'http_error';
}

/**
 * Sanitize URL to remove sensitive query parameters and personal data
 */
function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url, window.location.origin);

    // List of sensitive query parameters to remove or mask
    const sensitiveParams = [
      'token',
      'api_key',
      'apikey',
      'password',
      'secret',
      'auth',
      'authorization',
      'key',
      'session',
      'jwt',
      'bearer',
    ];

    // Remove or mask sensitive parameters
    sensitiveParams.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });

    // Remove user info from URL if present
    urlObj.username = '';
    urlObj.password = '';

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return a safe fallback
    return '[REDACTED_URL]';
  }
}

// Removed unused shouldCaptureError function to fix ESLint error
