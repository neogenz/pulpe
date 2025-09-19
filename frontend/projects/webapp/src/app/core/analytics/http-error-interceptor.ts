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
 * Typed HTTP error event names for better type safety and auto-completion
 */
type HttpErrorEvent =
  | 'http_server_error'
  | 'http_client_error'
  | 'http_network_error'
  | 'http_error';

/**
 * HTTP error interceptor for PostHog error tracking.
 * Leverages PostHog's built-in data sanitization for security.
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
    const errorContext = buildHttpErrorContext(error, requestMethod);

    // Log for development debugging
    if (applicationConfiguration.isDevelopment()) {
      logger.debug('HTTP Error captured for PostHog', errorContext);
    }

    // Determine event name based on error status
    const eventName = getHttpErrorEventName(error.status);

    // Let PostHogService handle all gating logic via #canCapture()
    postHogService.capture(eventName, errorContext);
  } catch (captureError) {
    // Log with more context for better debugging
    logger.warn('PostHog HTTP error capture failed', {
      originalError: error.status,
      captureError:
        captureError instanceof Error
          ? captureError.message
          : String(captureError),
      timestamp: new Date().toISOString(),
    });
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
    url: error.url || 'unknown',

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
function getHttpErrorEventName(status: number): HttpErrorEvent {
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
