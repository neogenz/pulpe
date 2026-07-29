import { Service, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { API_ERROR_CODES, type ApiErrorCode } from 'pulpe-shared';
import {
  CLIENT_ERROR_CODES,
  type ApiError,
  type ClientErrorCode,
} from './api-error';

type LocalizableCode = ApiErrorCode | ClientErrorCode;

const CODE_KEY_MAP = {
  [API_ERROR_CODES.BUDGET_NOT_FOUND]: 'apiError.budgetNotFound',
  [API_ERROR_CODES.BUDGET_CREATE_FAILED]: 'apiError.budgetCreationFailed',
  [API_ERROR_CODES.BUDGET_UPDATE_FAILED]: 'apiError.budgetUpdateFailed',
  [API_ERROR_CODES.BUDGET_DELETE_FAILED]: 'apiError.budgetDeleteFailed',
  [API_ERROR_CODES.BUDGET_ALREADY_EXISTS]: 'apiError.budgetAlreadyExists',
  [API_ERROR_CODES.TARGET_BUDGET_NOT_FOUND]: 'apiError.targetBudgetNotFound',
  [API_ERROR_CODES.BUDGET_LINE_NOT_FOUND]: 'apiError.budgetLineNotFound',
  [API_ERROR_CODES.BUDGET_LINE_CREATE_FAILED]:
    'apiError.budgetLineCreationFailed',
  [API_ERROR_CODES.BUDGET_LINE_UPDATE_FAILED]:
    'apiError.budgetLineUpdateFailed',
  [API_ERROR_CODES.BUDGET_LINE_DELETE_FAILED]:
    'apiError.budgetLineDeleteFailed',
  [API_ERROR_CODES.BUDGET_LINE_SPREAD_RECALCULATION_FAILED]:
    'apiError.budgetLineSpreadRecalculationFailed',
  [API_ERROR_CODES.SAVINGS_WITHDRAWAL_GROUP_NOT_FOUND]:
    'apiError.savingsWithdrawalGroupNotFound',
  [API_ERROR_CODES.SAVINGS_WITHDRAWAL_CONFLICT]:
    'apiError.savingsWithdrawalConflict',
  [API_ERROR_CODES.SAVINGS_WITHDRAWAL_MONTH_UNPROVISIONABLE]:
    'apiError.savingsWithdrawalMonthUnprovisionable',
  [API_ERROR_CODES.SAVINGS_WITHDRAWAL_RECALCULATION_FAILED]:
    'apiError.savingsWithdrawalRecalculationFailed',
  [API_ERROR_CODES.TRANSACTION_NOT_FOUND]: 'apiError.transactionNotFound',
  [API_ERROR_CODES.TRANSACTION_CREATE_FAILED]:
    'apiError.transactionCreationFailed',
  [API_ERROR_CODES.TRANSACTION_UPDATE_FAILED]:
    'apiError.transactionUpdateFailed',
  [API_ERROR_CODES.TRANSACTION_DELETE_FAILED]:
    'apiError.transactionDeleteFailed',
  [API_ERROR_CODES.TRANSACTION_ALREADY_CHECKED]:
    'apiError.transactionAlreadyChecked',
  [API_ERROR_CODES.TRANSACTION_ALLOCATED]: 'apiError.transactionAllocated',
  [API_ERROR_CODES.BUDGET_LINE_ALREADY_CHECKED]:
    'apiError.budgetLineAlreadyChecked',
  [API_ERROR_CODES.BUDGET_LINE_NOT_POSTPONABLE]:
    'apiError.budgetLineNotPostponable',
  [API_ERROR_CODES.BUDGET_LINE_HAS_TRANSACTIONS]:
    'apiError.budgetLineHasTransactions',
  [API_ERROR_CODES.CONCURRENT_MODIFICATION]: 'apiError.concurrentModification',
  [API_ERROR_CODES.TEMPLATE_NOT_FOUND]: 'apiError.templateNotFound',
  [API_ERROR_CODES.TEMPLATE_CREATE_FAILED]: 'apiError.templateCreationFailed',
  [API_ERROR_CODES.TEMPLATE_UPDATE_FAILED]: 'apiError.templateUpdateFailed',
  [API_ERROR_CODES.TEMPLATE_DELETE_FAILED]: 'apiError.templateDeleteFailed',
  [API_ERROR_CODES.SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED]:
    'apiError.savingsGoalBaselineRecalculationFailed',
  [API_ERROR_CODES.SAVINGS_GOAL_LINE_OUTSIDE_HORIZON]:
    'apiError.savingsGoalLineOutsideHorizon',
  [API_ERROR_CODES.SAVINGS_GOAL_PLAN_CONFLICT]:
    'apiError.savingsGoalPlanConflict',
  [API_ERROR_CODES.SAVINGS_GOAL_PLAN_LINE_INVALID]:
    'apiError.savingsGoalPlanLineInvalid',
  [API_ERROR_CODES.SAVINGS_GOAL_PLAN_APPLY_FAILED]:
    'apiError.savingsGoalPlanApplyFailed',
  [API_ERROR_CODES.SAVINGS_GOAL_GENERATION_STOP_CONFLICT]:
    'apiError.savingsGoalGenerationStopConflict',
  [API_ERROR_CODES.SAVINGS_GOAL_GENERATION_STOP_LINE_INVALID]:
    'apiError.savingsGoalGenerationStopLineInvalid',
  [API_ERROR_CODES.SAVINGS_GOAL_GENERATION_STOP_RECALCULATION_FAILED]:
    'apiError.savingsGoalGenerationStopRecalculationFailed',
  [API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_REQUIRED]:
    'apiError.savingsGoalReconciliationRequired',
  [API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_CONFLICT]:
    'apiError.savingsGoalReconciliationConflict',
  [API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_FAILED]:
    'apiError.savingsGoalReconciliationFailed',
  [API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_RECALCULATION_FAILED]:
    'apiError.savingsGoalReconciliationRecalculationFailed',
  [API_ERROR_CODES.SAVINGS_GOAL_DELETION_IMPACT_CHANGED]:
    'apiError.savingsGoalDeletionImpactChanged',
  [API_ERROR_CODES.SAVINGS_GOAL_DELETION_RECALCULATION_FAILED]:
    'apiError.savingsGoalDeletionRecalculationFailed',
  [API_ERROR_CODES.USER_NOT_FOUND]: 'apiError.profileNotFound',
  [API_ERROR_CODES.USER_PROFILE_UPDATE_FAILED]: 'apiError.profileUpdateFailed',
  [API_ERROR_CODES.VALIDATION_FAILED]: 'apiError.validationFailed',
  [API_ERROR_CODES.AUTH_UNAUTHORIZED]: 'apiError.unauthorized',
  [API_ERROR_CODES.RECOVERY_KEY_INVALID]: 'apiError.recoveryKeyInvalid',
  [API_ERROR_CODES.RECOVERY_KEY_NOT_CONFIGURED]:
    'apiError.recoveryKeyNotConfigured',
  [CLIENT_ERROR_CODES.ZOD_PARSE_ERROR]: 'apiError.clientValidationFailed',
} as const satisfies Partial<Record<LocalizableCode, string>>;

@Service()
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
