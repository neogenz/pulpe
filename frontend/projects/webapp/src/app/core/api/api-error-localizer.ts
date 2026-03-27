import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { API_ERROR_CODES, type ApiErrorCode } from 'pulpe-shared';
import type { ApiError } from './api-error';

const CODE_KEY_MAP = {
  [API_ERROR_CODES.BUDGET_NOT_FOUND]: 'apiError.budgetNotFound',
  [API_ERROR_CODES.BUDGET_CREATE_FAILED]: 'apiError.budgetCreationFailed',
  [API_ERROR_CODES.BUDGET_UPDATE_FAILED]: 'apiError.budgetUpdateFailed',
  [API_ERROR_CODES.BUDGET_DELETE_FAILED]: 'apiError.budgetDeleteFailed',
  [API_ERROR_CODES.BUDGET_ALREADY_EXISTS]: 'apiError.budgetAlreadyExists',
  [API_ERROR_CODES.BUDGET_LINE_NOT_FOUND]: 'apiError.budgetLineNotFound',
  [API_ERROR_CODES.BUDGET_LINE_CREATE_FAILED]:
    'apiError.budgetLineCreationFailed',
  [API_ERROR_CODES.BUDGET_LINE_UPDATE_FAILED]:
    'apiError.budgetLineUpdateFailed',
  [API_ERROR_CODES.BUDGET_LINE_DELETE_FAILED]:
    'apiError.budgetLineDeleteFailed',
  [API_ERROR_CODES.TRANSACTION_NOT_FOUND]: 'apiError.transactionNotFound',
  [API_ERROR_CODES.TRANSACTION_CREATE_FAILED]:
    'apiError.transactionCreationFailed',
  [API_ERROR_CODES.TRANSACTION_UPDATE_FAILED]:
    'apiError.transactionUpdateFailed',
  [API_ERROR_CODES.TRANSACTION_DELETE_FAILED]:
    'apiError.transactionDeleteFailed',
  [API_ERROR_CODES.TEMPLATE_NOT_FOUND]: 'apiError.templateNotFound',
  [API_ERROR_CODES.TEMPLATE_CREATE_FAILED]: 'apiError.templateCreationFailed',
  [API_ERROR_CODES.TEMPLATE_UPDATE_FAILED]: 'apiError.templateUpdateFailed',
  [API_ERROR_CODES.TEMPLATE_DELETE_FAILED]: 'apiError.templateDeleteFailed',
  [API_ERROR_CODES.USER_NOT_FOUND]: 'apiError.profileNotFound',
  [API_ERROR_CODES.USER_PROFILE_UPDATE_FAILED]: 'apiError.profileUpdateFailed',
  [API_ERROR_CODES.VALIDATION_FAILED]: 'apiError.validationFailed',
  [API_ERROR_CODES.AUTH_UNAUTHORIZED]: 'apiError.unauthorized',
  [API_ERROR_CODES.RECOVERY_KEY_INVALID]: 'apiError.recoveryKeyInvalid',
  [API_ERROR_CODES.RECOVERY_KEY_NOT_CONFIGURED]:
    'apiError.recoveryKeyNotConfigured',
} as const satisfies Partial<Record<ApiErrorCode, string>>;

@Injectable({ providedIn: 'root' })
export class ApiErrorLocalizer {
  readonly #transloco = inject(TranslocoService);

  localizeApiError(error: ApiError): string {
    if (error.status === 429) {
      return this.#transloco.translate('apiError.rateLimited');
    }
    if (error.code && error.code in CODE_KEY_MAP) {
      const key = CODE_KEY_MAP[error.code as keyof typeof CODE_KEY_MAP];
      return this.#transloco.translate(key);
    }
    return this.#transloco.translate('apiError.generic');
  }
}
