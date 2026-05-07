import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { TransactionCreate, TransactionUpdate } from 'pulpe-shared';

const TRANSACTION_CONSTANTS = {
  MAX_AMOUNT: 1000000,
  NAME_MAX_LENGTH: 100,
} as const;

export class TransactionInvariants {
  static validateCreate(dto: TransactionCreate): void {
    if (!dto.budgetId) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['budgetId'],
      });
    }

    if (!dto.amount || dto.amount <= 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        { reason: 'Amount must be greater than 0' },
      );
    }

    if (dto.amount > TRANSACTION_CONSTANTS.MAX_AMOUNT) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        { reason: `Amount cannot exceed ${TRANSACTION_CONSTANTS.MAX_AMOUNT}` },
      );
    }

    if (!dto.name || dto.name.trim().length === 0) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['name'],
      });
    }

    if (dto.name.length > TRANSACTION_CONSTANTS.NAME_MAX_LENGTH) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        {
          reason: `Name cannot exceed ${TRANSACTION_CONSTANTS.NAME_MAX_LENGTH} characters`,
        },
      );
    }
  }

  static validateUpdate(dto: TransactionUpdate): void {
    if (dto.amount !== undefined) {
      if (dto.amount <= 0) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
          { reason: 'Amount must be greater than 0' },
        );
      }
      if (dto.amount > TRANSACTION_CONSTANTS.MAX_AMOUNT) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
          {
            reason: `Amount cannot exceed ${TRANSACTION_CONSTANTS.MAX_AMOUNT}`,
          },
        );
      }
    }

    if (dto.name !== undefined) {
      if (dto.name.trim().length === 0) {
        throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
          fields: ['name'],
        });
      }
      if (dto.name.length > TRANSACTION_CONSTANTS.NAME_MAX_LENGTH) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
          {
            reason: `Name cannot exceed ${TRANSACTION_CONSTANTS.NAME_MAX_LENGTH} characters`,
          },
        );
      }
    }
  }
}
