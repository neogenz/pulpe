import { HttpErrorResponse } from '@angular/common/http';
import { errorResponseSchema } from 'pulpe-shared';
import { ZodError } from 'zod';

export const CLIENT_ERROR_CODES = {
  ZOD_PARSE_ERROR: 'ZOD_PARSE_ERROR',
} as const;

export type ClientErrorCode =
  (typeof CLIENT_ERROR_CODES)[keyof typeof CLIENT_ERROR_CODES];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ZodError) {
    return new ApiError(
      `Validation failed: ${error.issues.map((i) => i.message).join(', ')}`,
      CLIENT_ERROR_CODES.ZOD_PARSE_ERROR,
      0,
      error.issues,
    );
  }

  if (error instanceof HttpErrorResponse) {
    const parsed = errorResponseSchema.safeParse(error.error);

    if (parsed.success) {
      return new ApiError(
        parsed.data.message ?? parsed.data.error,
        parsed.data.code,
        error.status,
        parsed.data.details,
      );
    }

    // Fallback: raw error payload
    const message =
      typeof error.error === 'string'
        ? error.error
        : error.message || 'Server error';

    return new ApiError(message, undefined, error.status, error.error);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, undefined, 0, undefined);
  }

  return new ApiError('Unknown error', undefined, 0, error);
}
