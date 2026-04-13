import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { API_ERROR_CODES } from 'pulpe-shared';
import { ApiError } from './api-error';
import {
  isExpectedBusinessApiError,
  isExpectedBusinessHttpError,
} from './http-expected-business-noise';

describe('isExpectedBusinessHttpError', () => {
  it('returns true for HTTP 0 (no response received)', () => {
    const error = new HttpErrorResponse({
      status: 0,
      statusText: 'Unknown Error',
      url: 'https://api.pulpe.app/api/v1/budgets',
    });
    expect(isExpectedBusinessHttpError(error)).toBe(true);
  });

  it('returns true for HTTP 429', () => {
    const error = new HttpErrorResponse({
      status: 429,
      statusText: 'Too Many Requests',
    });
    expect(isExpectedBusinessHttpError(error)).toBe(true);
  });

  it('returns true for 400 with ERR_RECOVERY_KEY_INVALID', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { code: API_ERROR_CODES.RECOVERY_KEY_INVALID },
    });
    expect(isExpectedBusinessHttpError(error)).toBe(true);
  });

  it('returns true for 400 with ERR_ENCRYPTION_KEY_CHECK_FAILED', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { code: API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED },
    });
    expect(isExpectedBusinessHttpError(error)).toBe(true);
  });

  it('returns false for 400 with unrelated business code', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { code: 'ERR_BUDGET_NOT_FOUND' },
    });
    expect(isExpectedBusinessHttpError(error)).toBe(false);
  });

  it('returns false for 500', () => {
    const error = new HttpErrorResponse({
      status: 500,
      error: { code: API_ERROR_CODES.RECOVERY_KEY_INVALID },
    });
    expect(isExpectedBusinessHttpError(error)).toBe(false);
  });
});

describe('isExpectedBusinessApiError', () => {
  it('returns false for non-ApiError', () => {
    expect(isExpectedBusinessApiError(new Error('x'))).toBe(false);
  });

  it('returns false for status 0 ApiError (Zod parse / generic JS error)', () => {
    const error = new ApiError('x', 'ZOD_PARSE_ERROR', 0, undefined);
    expect(isExpectedBusinessApiError(error)).toBe(false);
  });

  it('returns true for 429 ApiError', () => {
    const error = new ApiError('x', 'CODE', 429, undefined);
    expect(isExpectedBusinessApiError(error)).toBe(true);
  });

  it('returns true for 400 with recovery key invalid', () => {
    const error = new ApiError(
      'x',
      API_ERROR_CODES.RECOVERY_KEY_INVALID,
      400,
      undefined,
    );
    expect(isExpectedBusinessApiError(error)).toBe(true);
  });
});
