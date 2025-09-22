import type {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { PostHogService, sanitizeUrl, sanitizeRecord } from '@core/analytics';
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
    const posthogError = normalizeHttpError(error);
    const context: HttpErrorContext = {
      source: 'http_interceptor',
      httpMethod: requestMethod,
      httpStatus: error.status,
      errorName: posthogError.name,
      errorMessage: posthogError.message,
    };

    if (error.url) {
      context.httpUrl = sanitizeUrl(error.url);
    }

    const backendPayload = extractBackendPayload(error.error);
    if (backendPayload) {
      context.backendErrorCode = readStringField(backendPayload, 'code');
      context.backendErrorName = readStringField(backendPayload, 'error');
      context.backendErrorMessage = readStringField(backendPayload, 'message');
      context.backendStatusCode =
        readNumberField(backendPayload, 'statusCode') ??
        readNumberField(backendPayload, 'status');
      context.backendMethod = readStringField(backendPayload, 'method');
      context.backendPath = readStringField(backendPayload, 'path');
      context.backendSuccess = readBooleanField(backendPayload, 'success');
      context.backendErrorContext = backendPayload['context'];
    }

    const sanitizedContext = sanitizeRecord(context);

    // Log for development debugging
    if (applicationConfiguration.isDevelopment()) {
      logger.debug('HTTP Error captured for PostHog', sanitizedContext);
    }

    // Capture HTTP error as exception for proper error tracking
    postHogService.captureException(posthogError, sanitizedContext);
  } catch (captureError) {
    logger.warn('PostHog HTTP error capture failed', captureError);
  }
}

function normalizeHttpError(error: HttpErrorResponse): Error {
  if (error instanceof Error) {
    return error;
  }

  const backendPayload = error.error;

  const payloadMessage =
    typeof backendPayload === 'string'
      ? backendPayload
      : typeof backendPayload?.message === 'string'
        ? backendPayload.message
        : undefined;

  const message =
    payloadMessage ??
    error.message ??
    `HTTP error ${error.status}${error.statusText ? ` - ${error.statusText}` : ''}`;

  const normalizedError = new Error(message, {
    cause: backendPayload ?? error,
  });
  normalizedError.name = error.name ?? 'HttpErrorResponse';

  const stack = (error as Partial<Error>).stack;
  if (stack) {
    normalizedError.stack = stack;
  }

  return normalizedError;
}

interface HttpErrorContext extends Record<string, unknown> {
  source: string;
  httpMethod: string;
  httpStatus: number;
  errorName: string;
  errorMessage: string;
  httpUrl?: string;
  backendErrorCode?: string;
  backendErrorName?: string;
  backendErrorMessage?: string;
  backendStatusCode?: number;
  backendMethod?: string;
  backendPath?: string;
  backendSuccess?: boolean;
  backendErrorContext?: unknown;
}

function extractBackendPayload(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readStringField(
  source: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  const fieldValue = source[fieldName];
  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

function readNumberField(
  source: Record<string, unknown>,
  fieldName: string,
): number | undefined {
  const fieldValue = source[fieldName];
  return typeof fieldValue === 'number' ? fieldValue : undefined;
}

function readBooleanField(
  source: Record<string, unknown>,
  fieldName: string,
): boolean | undefined {
  const fieldValue = source[fieldName];
  return typeof fieldValue === 'boolean' ? fieldValue : undefined;
}
