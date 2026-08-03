import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { TransactionCreate, TransactionUpdate } from 'pulpe-shared';
import type { SpreadSourceTransaction } from './transaction.entity';

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

  /**
   * PUL-17 v1.1 eligibility for total-preserving spread of an EXISTING réel:
   * only a FREE (unallocated) non-income transaction can be smoothed. An
   * allocated transaction derives its smoothing from its parent envelope line,
   * so the user is steered to spread that line instead.
   */
  static validateSpreadFromTransactionSource(
    source: SpreadSourceTransaction,
  ): void {
    if (source.budgetLineId !== null) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_SPREADABLE,
        {
          reason:
            'this transaction is allocated to an envelope; smooth the envelope line instead',
        },
      );
    }

    if (source.kind === 'income') {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_SPREADABLE,
        { reason: 'income transactions cannot be smoothed' },
      );
    }

    // splitTotalPreserving rejects a non-positive total with a raw Error → reject
    // here with a clean 400 instead of letting it surface as a 500.
    if (source.amount <= 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_SPREADABLE,
        {
          reason: 'only a transaction with a positive amount can be smoothed',
        },
      );
    }
  }

  /**
   * PUL-329 — un revenu issu d'un objectif garde son origine et son type pour
   * toujours. Le nom, le montant, la date et les tags restent librement
   * éditables ; le type ne l'est plus, parce qu'une dépense « provenant » d'un
   * objectif n'a pas de sens comptable et qu'une épargne ferait double emploi
   * avec les contributions.
   *
   * Le lien lui-même n'est pas défendu ici : `transactionUpdateSchema` ne porte
   * simplement pas `sourceSavingsGoalId`, donc aucun contrat d'édition ne peut
   * l'exprimer. Cette garde couvre le seul champ que le contrat autorise et
   * que la règle refuse.
   *
   * Vaut pour un lien CASSÉ autant qu'actif : l'objectif a disparu, mais la
   * transaction reste l'historique d'un revenu venu de l'épargne.
   */
  static validateWithdrawalUpdate(dto: TransactionUpdate): void {
    if (dto.kind !== undefined && dto.kind !== 'income') {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_TRANSACTION_INVALID,
        {
          reason:
            'a savings-goal-sourced income cannot change kind, only a new transaction can',
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
