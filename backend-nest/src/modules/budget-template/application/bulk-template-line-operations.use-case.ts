import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLinesBulkOperations,
  type TemplateLinesPropagationSummary,
  type TemplateLineUpdateWithId,
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
  TemplateLine,
  TemplateLineCreateInput,
  TemplateLineRpcUpdate,
  BulkTemplateLineOperationsResult,
} from '../domain/budget-template.entity';

interface BulkOperationsResult {
  deletedIds: string[];
  updatedLines: TemplateLine[];
  createdLines: TemplateLine[];
}

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
    const deleteIds = validated.delete || [];

    if (deleteIds.length) {
      await this.repo.validateLinesExist(templateId, deleteIds);
    }

    const operationsResult = await this.applyBulkOperations(
      templateId,
      validated,
      deleteIds,
    );

    const propagationSummary = await this.handlePropagation(
      templateId,
      user,
      validated.propagateToBudgets,
      operationsResult,
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
      deletedIds: operationsResult.deletedIds,
      updatedLines: operationsResult.updatedLines,
      createdLines: operationsResult.createdLines,
      propagation: propagationSummary,
    };
  }

  private async applyBulkOperations(
    templateId: string,
    validated: TemplateLinesBulkOperations,
    deleteIds: string[],
  ): Promise<BulkOperationsResult> {
    return {
      deletedIds: deleteIds,
      updatedLines: await this.performBulkUpdates(
        validated.update || [],
        templateId,
      ),
      createdLines: await this.performBulkCreates(
        validated.create || [],
        templateId,
      ),
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

  private async handlePropagation(
    templateId: string,
    user: AuthenticatedUser,
    propagateToBudgets: boolean,
    operations: BulkOperationsResult,
  ): Promise<TemplateLinesPropagationSummary> {
    const hasDeletes = operations.deletedIds.length > 0;
    const hasBudgetMutations =
      operations.updatedLines.length > 0 || operations.createdLines.length > 0;

    if (!propagateToBudgets) {
      if (hasDeletes) {
        await this.applyRpc(templateId, [], operations);
      }
      return {
        mode: 'template-only',
        affectedBudgetIds: [],
        affectedBudgetsCount: 0,
      };
    }

    if (!hasDeletes && !hasBudgetMutations) {
      return EMPTY_PROPAGATION_SUMMARY;
    }

    return this.propagateToBudgets(templateId, operations, user);
  }

  private async propagateToBudgets(
    templateId: string,
    operations: BulkOperationsResult,
    user: AuthenticatedUser,
  ): Promise<TemplateLinesPropagationSummary> {
    this.logPropagationStart(templateId, user.id, operations);

    const now = new Date();
    const budgets = await this.repo.fetchFutureBudgets(templateId, user.id, {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
    const budgetIds = budgets.map((b) => b.id);

    if (!budgetIds.length) {
      await this.applyRpc(templateId, [], operations);
      this.logger.warn(
        {
          operation: 'propagateTemplateChangesToBudgets',
          templateId,
          userId: user.id,
        },
        'No budgets found for propagation',
      );
      return EMPTY_PROPAGATION_SUMMARY;
    }

    const affectedBudgetIds = await this.applyRpc(
      templateId,
      budgetIds,
      operations,
    );

    if (affectedBudgetIds.length) {
      await Promise.all(
        affectedBudgetIds.map((id) =>
          this.budgetRecalculation.recalculate(id, user.clientKey),
        ),
      );
    }

    return {
      mode: 'propagate',
      affectedBudgetIds,
      affectedBudgetsCount: affectedBudgetIds.length,
    };
  }

  private logPropagationStart(
    templateId: string,
    userId: string,
    operations: BulkOperationsResult,
  ): void {
    this.logger.info(
      {
        operation: 'propagateTemplateChangesToBudgets',
        templateId,
        userId,
        operations: {
          deletedCount: operations.deletedIds.length,
          updatedCount: operations.updatedLines.length,
          createdCount: operations.createdLines.length,
        },
      },
      'Starting template propagation to budgets',
    );
  }

  private async applyRpc(
    templateId: string,
    budgetIds: string[],
    operations: BulkOperationsResult,
  ): Promise<string[]> {
    const hasDeletes = operations.deletedIds.length > 0;
    const hasBudgetMutations =
      budgetIds.length > 0 &&
      (operations.updatedLines.length > 0 ||
        operations.createdLines.length > 0);
    if (!hasDeletes && !hasBudgetMutations) return [];

    const result = await this.repo.bulkApplyTemplateLineOperations({
      templateId,
      budgetIds,
      deleteIds: operations.deletedIds,
      updatedLines: hasBudgetMutations
        ? operations.updatedLines.map((line) => this.entityToRpcUpdate(line))
        : [],
      createdLines: hasBudgetMutations
        ? operations.createdLines.map((line) => this.entityToRpcUpdate(line))
        : [],
    });

    return result.affectedBudgetIds;
  }

  private async performBulkUpdates(
    updates: TemplateLineUpdateWithId[],
    templateId: string,
  ): Promise<TemplateLine[]> {
    if (!updates.length) return [];

    const updateIds = updates.map((u) => u.id);
    await this.repo.validateLinesExist(templateId, updateIds);

    const overridden = await Promise.all(
      updates.map(async (line) => {
        const { id, ...rest } = line;
        const overriddenRest =
          await this.currencyService.overrideExchangeRate(rest);
        return { id, ...overriddenRest };
      }),
    );

    return Promise.all(
      overridden.map(({ id, ...rest }) =>
        this.repo.updateLine(id, {
          name: rest.name,
          amount: rest.amount,
          originalAmount: rest.originalAmount,
          originalCurrency: rest.originalCurrency,
          targetCurrency: rest.targetCurrency,
          exchangeRate: rest.exchangeRate,
          kind: rest.kind,
          recurrence: rest.recurrence,
          description: rest.description,
        }),
      ),
    );
  }

  private async performBulkCreates(
    creates: TemplateLineCreateWithoutTemplateId[],
    templateId: string,
  ): Promise<TemplateLine[]> {
    if (!creates.length) return [];

    const overridden = await Promise.all(
      creates.map((line) => this.currencyService.overrideExchangeRate(line)),
    );

    return Promise.all(
      overridden.map((line) =>
        this.repo.insertLine(this.toCreateInput(line, templateId)),
      ),
    );
  }

  private toCreateInput(
    line: TemplateLineCreateWithoutTemplateId,
    templateId: string,
  ): TemplateLineCreateInput {
    return {
      templateId,
      name: line.name,
      amount: line.amount,
      originalAmount: line.originalAmount,
      originalCurrency: line.originalCurrency,
      targetCurrency: line.targetCurrency,
      exchangeRate: line.exchangeRate,
      kind: line.kind,
      recurrence: line.recurrence,
      description: line.description,
    };
  }

  private entityToRpcUpdate(entity: TemplateLine): TemplateLineRpcUpdate {
    return {
      id: entity.id,
      name: entity.name,
      amount: entity.amount,
      originalAmount: entity.originalAmount,
      originalCurrency: entity.originalCurrency,
      targetCurrency: entity.targetCurrency,
      exchangeRate: entity.exchangeRate,
      kind: entity.kind,
      recurrence: entity.recurrence,
    };
  }
}
