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
 * Capture HTTP error as exception to PostHog for error tracking
 */
function captureHttpError(
  error: HttpErrorResponse,
  requestMethod: string,
  postHogService: PostHogService,
  logger: Logger,
  applicationConfiguration: ApplicationConfiguration,
): void {
  try {
    // Minimal context - PostHog handles most metadata automatically
    const context = {
      httpMethod: requestMethod,
      httpStatus: error.status,
      source: 'http_interceptor',
    };

    // Log for development debugging
    if (applicationConfiguration.isDevelopment()) {
      logger.debug('HTTP Error captured for PostHog', context);
    }

    // Capture HTTP error as exception for proper error tracking
    postHogService.captureException(error, context);
  } catch (captureError) {
    logger.warn('PostHog HTTP error capture failed', captureError);
  }
}
