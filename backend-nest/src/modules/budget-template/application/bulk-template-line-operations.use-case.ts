import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  type TemplateLinesBulkOperations,
  type TemplateLinesPropagationSummary,
  templateLinesBulkOperationsSchema,
} from 'pulpe-shared';
import { CurrencyService } from '@modules/currency/currency.service';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import type {
  TemplateLineRpcUpdate,
  BulkTemplateLineOperationsResult,
} from '../domain/budget-template.entity';

const EMPTY_PROPAGATION_SUMMARY: TemplateLinesPropagationSummary = {
  mode: 'propagate',
  affectedBudgetIds: [],
  affectedBudgetsCount: 0,
};

@Injectable()
export class BulkTemplateLineOperationsUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly currencyService: CurrencyService,
    private readonly cacheService: CacheService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(BulkTemplateLineOperationsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    templateId: string,
    bulkOperationsDto: TemplateLinesBulkOperations,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<BulkTemplateLineOperationsResult> {
    const startTime = Date.now();

    await this.repo.validateAccess(templateId, user.id);

    const validated =
      templateLinesBulkOperationsSchema.parse(bulkOperationsDto);
    const deleteIds = validated.delete ?? [];
    const rawUpdates = validated.update ?? [];
    const rawCreates = validated.create ?? [];

    if (deleteIds.length) {
      await this.repo.validateLinesExist(templateId, deleteIds);
    }

    if (rawUpdates.length) {
      await this.repo.validateLinesExist(
        templateId,
        rawUpdates.map((line) => line.id),
      );
    }

    const updatedLines = await this.toRpcUpdates(rawUpdates);
    const createdLines = await this.toRpcCreates(rawCreates);

    const budgetIds = validated.propagateToBudgets
      ? await this.fetchPropagationBudgetIds(templateId, user.id)
      : [];

    const hasAnyMutation =
      deleteIds.length > 0 ||
      updatedLines.length > 0 ||
      createdLines.length > 0;

    const repoResult = hasAnyMutation
      ? await this.repo.bulkApplyTemplateLineOperations({
          templateId,
          budgetIds,
          deleteIds,
          updatedLines,
          createdLines,
        })
      : { affectedBudgetIds: [], updatedLines: [], createdLines: [] };

    if (repoResult.affectedBudgetIds.length) {
      await Promise.all(
        repoResult.affectedBudgetIds.map((id) =>
          this.budgetRecalculation.recalculate(id, user.clientKey),
        ),
      );
    }

    const propagationSummary = this.buildPropagationSummary(
      validated.propagateToBudgets,
      repoResult.affectedBudgetIds,
    );

    if (propagationSummary.affectedBudgetsCount > 0) {
      await this.cacheService.invalidateForUser(user.id);
    }

    this.logBulkOperationsCompleted(
      templateId,
      user,
      validated,
      deleteIds.length,
      propagationSummary,
      Date.now() - startTime,
    );

    return {
      deletedIds: deleteIds,
      updatedLines: repoResult.updatedLines,
      createdLines: repoResult.createdLines,
      propagation: propagationSummary,
    };
  }

  private async fetchPropagationBudgetIds(
    templateId: string,
    userId: string,
  ): Promise<string[]> {
    const now = new Date();
    const budgets = await this.repo.fetchFutureBudgets(templateId, userId, {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
    return budgets.map((b) => b.id);
  }

  private async toRpcUpdates(
    updates: TemplateLinesBulkOperations['update'],
  ): Promise<TemplateLineRpcUpdate[]> {
    if (!updates?.length) return [];

    return Promise.all(
      updates.map(async (line) => {
        const { id, ...rest } = line;
        const overridden =
          await this.currencyService.overrideExchangeRate(rest);
        return { id, ...overridden };
      }),
    );
  }

  private async toRpcCreates(
    creates: TemplateLinesBulkOperations['create'],
  ): Promise<TemplateLineRpcUpdate[]> {
    if (!creates?.length) return [];

    const overridden = await Promise.all(
      creates.map((line) => this.currencyService.overrideExchangeRate(line)),
    );

    return overridden.map((line) => ({
      id: randomUUID(),
      ...line,
    }));
  }

  private buildPropagationSummary(
    propagateToBudgets: boolean,
    affectedBudgetIds: string[],
  ): TemplateLinesPropagationSummary {
    if (!propagateToBudgets) {
      return {
        mode: 'template-only',
        affectedBudgetIds: [],
        affectedBudgetsCount: 0,
      };
    }
    if (!affectedBudgetIds.length) return EMPTY_PROPAGATION_SUMMARY;
    return {
      mode: 'propagate',
      affectedBudgetIds,
      affectedBudgetsCount: affectedBudgetIds.length,
    };
  }

  private logBulkOperationsCompleted(
    templateId: string,
    user: AuthenticatedUser,
    validated: TemplateLinesBulkOperations,
    deletedCount: number,
    propagationSummary: TemplateLinesPropagationSummary,
    duration: number,
  ): void {
    this.logger.info(
      {
        operation: 'bulkOperationsTemplateLines',
        userId: user.id,
        entityId: templateId,
        operationCount: {
          create: validated.create?.length || 0,
          update: validated.update?.length || 0,
          delete: deletedCount,
        },
        propagateToBudgets: validated.propagateToBudgets,
        propagationImpact: {
          mode: propagationSummary.mode,
          affectedBudgetsCount: propagationSummary.affectedBudgetsCount,
        },
        duration,
      },
      'Bulk operations on template lines completed successfully',
    );
  }
}
