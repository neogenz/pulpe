import type {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { isExpectedBusinessHttpError } from '@core/api/http-expected-business-noise';
import { PostHogService, sanitizeUrl, sanitizeRecord } from '@core/analytics';
import { REQUEST_ID_HEADER } from 'pulpe-shared';
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
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Capture HTTP errors for monitoring
      captureHttpError(
        error,
        req.method,
        requestId,
        postHogService,
        logger,
        applicationConfiguration,
      );

      // Re-throw the error so it can be handled by the application
      return throwError(() => error);
    }),
  );
};

/** 401/403 are handled by authInterceptor (token refresh, redirect) — not bugs */
const AUTH_HANDLED_STATUSES = new Set([401, 403]);

/**
 * Capture HTTP error as exception to PostHog for error tracking
 */
function captureHttpError(
  error: HttpErrorResponse,
  requestMethod: string,
  requestId: string | undefined,
  postHogService: PostHogService,
  logger: Logger,
  applicationConfiguration: ApplicationConfiguration,
): void {
  if (AUTH_HANDLED_STATUSES.has(error.status)) {
    return;
  }

  if (isExpectedBusinessHttpError(error)) {
    return;
  }

  try {
    const posthogError = normalizeHttpError(error);
    const context: HttpErrorContext = {
      source: 'http_interceptor',
      httpMethod: requestMethod,
      httpStatus: error.status,
      errorName: posthogError.name,
      ...(requestId ? { request_id: requestId } : {}),
    };

    if (error.url) {
      context.httpUrl = sanitizeUrl(error.url);
    }

    const backendPayload = extractBackendPayload(error.error);
    if (backendPayload) {
      context.backendErrorCode = readTechnicalField(backendPayload, 'code');
      context.backendErrorName = readTechnicalField(backendPayload, 'error');
      context.backendStatusCode =
        readNumberField(backendPayload, 'statusCode') ??
        readNumberField(backendPayload, 'status');
      context.backendMethod = readStringField(backendPayload, 'method');
      const backendPath = readStringField(backendPayload, 'path');
      if (backendPath) context.backendPath = sanitizeUrl(backendPath);
      context.backendSuccess = readBooleanField(backendPayload, 'success');
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
  const backendPayload = extractBackendPayload(error.error);
  const code = backendPayload
    ? readTechnicalField(backendPayload, 'code')
    : undefined;
  const type = backendPayload
    ? readTechnicalField(backendPayload, 'error')
    : undefined;
  const label = ['HTTP', error.status, code, type].filter(Boolean).join(':');
  const normalizedError = new Error(label);
  normalizedError.name = label;

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
  request_id?: string;
  httpUrl?: string;
  backendErrorCode?: string;
  backendErrorName?: string;
  backendStatusCode?: number;
  backendMethod?: string;
  backendPath?: string;
  backendSuccess?: boolean;
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

function readTechnicalField(
  source: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  const value = readStringField(source, fieldName);
  return value && /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/.test(value)
    ? value
    : undefined;
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
