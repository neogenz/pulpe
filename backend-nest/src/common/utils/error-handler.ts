import { HttpException } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

/**
 * Handles errors by re-throwing known exceptions or wrapping unknown errors
 * @param error - The error to handle
 * @param fallbackErrorDefinition - The error definition to use for unknown errors
 * @param fallbackData - Additional data for the fallback error
 * @param contextData - Context data for logging/debugging
 * @param causeError - The original error to include as cause
 */
export function handleServiceError(
  error: unknown,
  fallbackErrorDefinition: (typeof ERROR_DEFINITIONS)[keyof typeof ERROR_DEFINITIONS],
  fallbackData?: Record<string, unknown>,
  contextData?: Record<string, unknown>,
  causeError?: unknown,
): never {
  // Re-throw known exceptions as-is
  if (error instanceof BusinessException || error instanceof HttpException) {
    throw error;
  }

  // Wrap unknown errors in BusinessException
  throw new BusinessException(
    fallbackErrorDefinition,
    fallbackData,
    contextData,
    { cause: causeError ?? error },
  );
}
