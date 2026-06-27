import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { BudgetLineCreate, BudgetLineUpdate } from 'pulpe-shared';
import type { SpreadSourceLine } from './budget-line.entity';

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

  /**
   * PUL-17 v1.1 eligibility for total-preserving spread of an EXISTING prévision:
   * only a one-off (Prévu) non-income line that is not already part of a spread
   * group can be smoothed. Recurring/income → NOT_SPREADABLE; a member of a
   * group → ALREADY_SPREAD.
   */
  static validateSpreadFromLineSource(source: SpreadSourceLine): void {
    if (source.recurrence !== 'one_off') {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_SPREADABLE,
        { reason: 'only a one-off (Prévu) line can be smoothed' },
      );
    }

    if (source.kind === 'income') {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_SPREADABLE,
        { reason: 'income lines cannot be smoothed' },
      );
    }

    if (source.spreadGroupId !== null) {
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_ALREADY_SPREAD);
    }

    // A 0 € line is a valid budget_line (validateCreate accepts amount >= 0) but
    // splitTotalPreserving rejects a non-positive total with a raw Error → reject
    // here with a clean 400 instead of letting it surface as a 500.
    if (source.amount <= 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_SPREADABLE,
        {
          reason: 'only a line with a positive amount can be smoothed',
        },
      );
    }
  }
}
