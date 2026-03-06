import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { ApiError } from './api-error';

const CODE_KEY_MAP = {
  ERR_BUDGET_NOT_FOUND: 'apiError.budgetNotFound',
  ERR_BUDGET_CREATION_FAILED: 'apiError.budgetCreationFailed',
  ERR_BUDGET_UPDATE_FAILED: 'apiError.budgetUpdateFailed',
  ERR_BUDGET_DELETE_FAILED: 'apiError.budgetDeleteFailed',
  ERR_BUDGET_ALREADY_EXISTS: 'apiError.budgetAlreadyExists',
  ERR_BUDGET_LINE_NOT_FOUND: 'apiError.budgetLineNotFound',
  ERR_BUDGET_LINE_CREATION_FAILED: 'apiError.budgetLineCreationFailed',
  ERR_BUDGET_LINE_UPDATE_FAILED: 'apiError.budgetLineUpdateFailed',
  ERR_BUDGET_LINE_DELETE_FAILED: 'apiError.budgetLineDeleteFailed',
  ERR_TRANSACTION_NOT_FOUND: 'apiError.transactionNotFound',
  ERR_TRANSACTION_CREATION_FAILED: 'apiError.transactionCreationFailed',
  ERR_TRANSACTION_UPDATE_FAILED: 'apiError.transactionUpdateFailed',
  ERR_TRANSACTION_DELETE_FAILED: 'apiError.transactionDeleteFailed',
  ERR_TEMPLATE_NOT_FOUND: 'apiError.templateNotFound',
  ERR_TEMPLATE_CREATION_FAILED: 'apiError.templateCreationFailed',
  ERR_TEMPLATE_UPDATE_FAILED: 'apiError.templateUpdateFailed',
  ERR_TEMPLATE_DELETE_FAILED: 'apiError.templateDeleteFailed',
  ERR_PROFILE_NOT_FOUND: 'apiError.profileNotFound',
  ERR_PROFILE_UPDATE_FAILED: 'apiError.profileUpdateFailed',
  ERR_VALIDATION_FAILED: 'apiError.validationFailed',
  ERR_UNAUTHORIZED: 'apiError.unauthorized',
  ERR_FORBIDDEN: 'apiError.forbidden',
} as const satisfies Record<string, string>;

@Injectable({ providedIn: 'root' })
export class ApiErrorLocalizer {
  readonly #transloco = inject(TranslocoService);

  localizeApiError(error: ApiError): string {
    if (error.code && error.code in CODE_KEY_MAP) {
      const key = CODE_KEY_MAP[error.code as keyof typeof CODE_KEY_MAP];
      return this.#transloco.translate(key);
    }
    return this.#transloco.translate('apiError.generic');
  }
}
