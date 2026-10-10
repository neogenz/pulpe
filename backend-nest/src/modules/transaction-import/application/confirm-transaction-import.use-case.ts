import { Inject, Injectable } from '@nestjs/common';
import type {
  TransactionImportDecision,
  TransactionImportResult,
} from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  TRANSACTION_IMPORT_REPOSITORY,
  type TransactionImportRepositoryPort,
} from '../domain/ports/transaction-import-repository.port';
import { planImport } from '../domain/transaction-import.matching';
import { TransactionImportAnalyzer } from './transaction-import-analyzer';

/**
 * Creates the file's new operations as Réels — all of them or none. Those the
 * user explicitly attached to a Prévision are attached and checked; every
 * other one stays free and unchecked. The file is analysed again rather than
 * trusting the preview: the same blocking errors refuse it, an operation
 * imported since the preview is skipped instead of duplicated, and a decision
 * that no longer fits refuses the whole import.
 */
@Injectable()
export class ConfirmTransactionImportUseCase {
  constructor(
    private readonly analyzer: TransactionImportAnalyzer,
    @Inject(TRANSACTION_IMPORT_REPOSITORY)
    private readonly repo: TransactionImportRepositoryPort,
    private readonly cacheService: CacheService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(ConfirmTransactionImportUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    content: string,
    budgetId: string,
    decisions: readonly TransactionImportDecision[],
    user: AuthenticatedUser,
  ): Promise<TransactionImportResult> {
    const { preview, candidates, lines } = await this.analyzer.analyze(
      content,
      budgetId,
    );

    if (preview.errors.length > 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_IMPORT_INVALID,
        { errorCount: preview.errors.length },
        {
          operation: 'transactionImport.confirm',
          userId: user.id,
          budgetId,
          errorCodes: [...new Set(preview.errors.map((error) => error.code))],
        },
      );
    }

    const plan = planImport({
      candidates,
      decisions,
      lines,
      checkedAt: new Date().toISOString(),
    });
    if ('problem' in plan) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_IMPORT_INVALID,
        { reason: `${plan.problem} at operation ${plan.position}` },
        {
          operation: 'transactionImport.confirm.planImport',
          userId: user.id,
          budgetId,
          problem: plan.problem,
        },
      );
    }

    const { planned } = plan;
    const attachedCount = planned.filter(
      (entry) => entry.budgetLineId !== null,
    ).length;
    const skippedCount = preview.operations.length - planned.length;
    if (planned.length === 0) {
      return { createdCount: 0, attachedCount: 0, skippedCount };
    }

    await this.repo.insertAll(budgetId, planned);
    // Before the recalculation: if it fails, no cached list may hide the rows.
    await this.cacheService.invalidateForUser(user.id);

    try {
      await this.budgetRecalculation.recalculate(budgetId);
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_IMPORT_RECALCULATION_FAILED,
        undefined,
        {
          operation: 'transactionImport.confirm.recalcAfterInsert',
          severity: 'critical',
          partialFailure: true,
          userId: user.id,
          budgetId,
          createdCount: planned.length,
        },
        { cause },
      );
    }

    this.logger.info(
      {
        operation: 'transactionImport.confirm',
        userId: user.id,
        budgetId,
        format: preview.format,
        createdCount: planned.length,
        attachedCount,
        skippedCount,
      },
      'Bank export imported',
    );

    return { createdCount: planned.length, attachedCount, skippedCount };
  }
}
