import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { BudgetCreate, BudgetUpdate } from 'pulpe-shared';
import { BUDGET_CONSTANTS } from './budget.constants';

export class BudgetInvariants {
  static validateCreate(dto: BudgetCreate): void {
    const missingFields: string[] = [];
    if (!dto.month) missingFields.push('month');
    if (!dto.year) missingFields.push('year');
    if (!dto.templateId) missingFields.push('templateId');

    if (missingFields.length > 0) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: missingFields,
      });
    }

    if (
      dto.month < BUDGET_CONSTANTS.MONTH_MIN ||
      dto.month > BUDGET_CONSTANTS.MONTH_MAX
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Month must be between ${BUDGET_CONSTANTS.MONTH_MIN} and ${BUDGET_CONSTANTS.MONTH_MAX}`,
      });
    }

    if (
      dto.year < BUDGET_CONSTANTS.MIN_YEAR ||
      dto.year > BUDGET_CONSTANTS.MAX_YEAR
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Year must be between ${BUDGET_CONSTANTS.MIN_YEAR} and ${BUDGET_CONSTANTS.MAX_YEAR}`,
      });
    }

    if (
      dto.description &&
      dto.description.length > BUDGET_CONSTANTS.DESCRIPTION_MAX_LENGTH
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Description cannot exceed ${BUDGET_CONSTANTS.DESCRIPTION_MAX_LENGTH} characters`,
      });
    }

    const now = new Date();
    const budgetDate = new Date(dto.year, dto.month - 1);
    const maxFutureDate = new Date(now.getFullYear() + 2, now.getMonth());

    if (budgetDate > maxFutureDate) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: 'Budget date cannot be more than 2 years in the future',
      });
    }
  }

  static validateUpdate(dto: BudgetUpdate): void {
    if (
      dto.month !== undefined &&
      (dto.month < BUDGET_CONSTANTS.MONTH_MIN ||
        dto.month > BUDGET_CONSTANTS.MONTH_MAX)
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Month must be between ${BUDGET_CONSTANTS.MONTH_MIN} and ${BUDGET_CONSTANTS.MONTH_MAX}`,
      });
    }

    if (
      dto.year !== undefined &&
      (dto.year < BUDGET_CONSTANTS.MIN_YEAR ||
        dto.year > BUDGET_CONSTANTS.MAX_YEAR)
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Year must be between ${BUDGET_CONSTANTS.MIN_YEAR} and ${BUDGET_CONSTANTS.MAX_YEAR}`,
      });
    }
  }
}
