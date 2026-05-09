import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { BudgetLineCreate, BudgetLineUpdate } from 'pulpe-shared';

export class BudgetLineInvariants {
  static validateCreate(dto: BudgetLineCreate): void {
    if (!dto.budgetId) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['budgetId'],
      });
    }

    if (dto.amount === undefined || dto.amount === null || dto.amount < 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_VALIDATION_FAILED,
        { reason: 'Amount must be greater than or equal to 0' },
      );
    }

    if (!dto.name || dto.name.trim().length === 0) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['name'],
      });
    }
  }

  static validateUpdate(dto: BudgetLineUpdate): void {
    if (dto.amount !== undefined && dto.amount < 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_VALIDATION_FAILED,
        { reason: 'Amount must be greater than or equal to 0' },
      );
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['name'],
      });
    }
  }

  static validateTemplateLineIdExists(templateLineId: string | null): void {
    if (!templateLineId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_VALIDATION_FAILED,
        { reason: 'Budget line has no associated template' },
      );
    }
  }
}
