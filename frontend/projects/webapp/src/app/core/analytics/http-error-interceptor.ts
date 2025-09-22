import type {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';
import { ApplicationConfiguration } from '../config/application-configuration';
import { sanitizeAnalyticsProperties, sanitizeUrl } from './posthog-sanitizer';

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
    const context: Record<string, unknown> = {
      source: 'http_interceptor',
      httpMethod: requestMethod,
      httpStatus: error.status,
      errorName: posthogError.name,
      errorMessage: posthogError.message,
    };

    if (error.url) {
      context.httpUrl = sanitizeUrl(error.url);
    }

    const backendError = extractBackendError(error.error);
    if (backendError) {
      assignIfDefined(context, 'backendErrorCode', backendError.code);
      assignIfDefined(context, 'backendErrorName', backendError.error);
      assignIfDefined(context, 'backendErrorMessage', backendError.message);
      assignIfDefined(context, 'backendStatusCode', backendError.statusCode);
      assignIfDefined(context, 'backendMethod', backendError.method);
      assignIfDefined(context, 'backendPath', backendError.path);
      assignIfDefined(context, 'backendSuccess', backendError.success);
      assignIfDefined(context, 'backendErrorContext', backendError.context);
    }

    const sanitizedContext = sanitizeAnalyticsProperties(context);

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

interface BackendErrorDetails {
  code?: string;
  error?: string;
  message?: string;
  statusCode?: number;
  method?: string;
  path?: string;
  success?: boolean;
  context?: unknown;
}

function extractBackendError(value: unknown): BackendErrorDetails | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const statusCode = extractStatusCode(value);
  const details: BackendErrorDetails = {
    code:
      typeof value['code'] === 'string' ? (value['code'] as string) : undefined,
    error:
      typeof value['error'] === 'string'
        ? (value['error'] as string)
        : undefined,
    message:
      typeof value['message'] === 'string'
        ? (value['message'] as string)
        : undefined,
    statusCode,
    method:
      typeof value['method'] === 'string'
        ? (value['method'] as string)
        : undefined,
    path:
      typeof value['path'] === 'string' ? (value['path'] as string) : undefined,
    success:
      typeof value['success'] === 'boolean'
        ? (value['success'] as boolean)
        : undefined,
    context: value['context'],
  };

  return hasAnyValue(details) ? details : null;
}

function extractStatusCode(value: Record<string, unknown>): number | undefined {
  if (typeof value['statusCode'] === 'number') {
    return value['statusCode'] as number;
  }
  if (typeof value['status'] === 'number') {
    return value['status'] as number;
  }
  return undefined;
}

function hasAnyValue(details: BackendErrorDetails): boolean {
  return Object.values(details).some((field) => field !== undefined);
}

function assignIfDefined(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
