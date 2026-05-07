import { HttpException } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

/**
 * Translates unknown errors into BusinessException with a typed fallback definition.
 *
 * Use when a catch block must distinguish between already-typed exceptions
 * (BusinessException / HttpException — re-thrown as-is) and raw unknown errors
 * from external APIs (Supabase, third-party SDKs) that need wrapping.
 *
 * Current call sites:
 * - budget.service.ts — budget create/update/delete operations
 * - budget-line.service.ts — budget-line mutations
 * - transaction.service.ts — transaction mutations
 * - budget-template.service.ts — template propagation + create
 *
 * DO NOT use as a generic catch-all wrapper: services that throw only
 * BusinessException directly don't need this function.
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
