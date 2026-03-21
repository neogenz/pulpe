import type { HttpErrorResponse } from '@angular/common/http';
import { API_ERROR_CODES } from 'pulpe-shared';
import { isApiError } from './api-error';

const EXPECTED_BUSINESS_ERROR_CODES: ReadonlySet<string> = new Set([
  API_ERROR_CODES.RECOVERY_KEY_INVALID,
  API_ERROR_CODES.RECOVERY_KEY_NOT_CONFIGURED,
  API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED,
]);

function matchesExpectedBusinessNoise(
  status: number,
  code: string | undefined,
): boolean {
  if (status === 429) {
    return true;
  }
  if (status !== 400) {
    return false;
  }
  return typeof code === 'string' && EXPECTED_BUSINESS_ERROR_CODES.has(code);
}

function readErrorBodyCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined;
  }
  const raw = (body as Record<string, unknown>)['code'];
  return typeof raw === 'string' ? raw : undefined;
}

export function isExpectedBusinessHttpError(error: HttpErrorResponse): boolean {
  return matchesExpectedBusinessNoise(
    error.status,
    readErrorBodyCode(error.error),
  );
}

export function isExpectedBusinessApiError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  return matchesExpectedBusinessNoise(error.status, error.code);
}
