import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLinesBulkOperations,
  type TemplateLinesBulkOperationsResponse,
  type TemplateLinesPropagationSummary,
  type TemplateLineUpdateWithId,
  templateLinesBulkOperationsSchema,
} from 'pulpe-shared';
import type { Tables, TablesInsert } from '@/types/database.types';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
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
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';
import { applyTemplateLineOperationsListSchema } from '../infrastructure/persistence/schemas/rpc-payload.schemas';

type BulkOperationsResult = {
  deletedIds: string[];
  updatedLines: Tables<'template_line'>[];
  createdLines: Tables<'template_line'>[];
};

@Injectable()
export class BulkTemplateLineOperationsUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly currencyService: CurrencyService,
    private readonly cacheService: CacheService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(BulkTemplateLineOperationsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    templateId: string,
    bulkOperationsDto: TemplateLinesBulkOperations,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLinesBulkOperationsResponse> {
    const startTime = Date.now();

    await this.repo.validateAccess(templateId, user.id);

    const validated =
      templateLinesBulkOperationsSchema.parse(bulkOperationsDto);
    const deleteIds = validated.delete || [];

    if (deleteIds.length) {
      await this.repo.validateLinesExist(templateId, deleteIds);
    }

    const updatedLines = await this.performBulkUpdates(
      validated.update || [],
      templateId,
      user,
    );
    const createdLines = await this.performBulkCreates(
      validated.create || [],
      templateId,
      user,
    );

    const operationsResult: BulkOperationsResult = {
      deletedIds: deleteIds,
      updatedLines,
      createdLines,
    };

    const propagationSummary = await this.handlePropagation(
      templateId,
      user,
      validated.propagateToBudgets,
      operationsResult,
      supabase,
    );

    if (propagationSummary.affectedBudgetsCount > 0) {
      await this.cacheService.invalidateForUser(user.id);
    }

    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decrypt = (l: Tables<'template_line'>) =>
      this.mapper.decryptLine(l, this.encryption, dek);

    const decryptedUpdated = operationsResult.updatedLines.map(decrypt);
    const decryptedCreated = operationsResult.createdLines.map(decrypt);

    this.logger.info(
      {
        operation: 'bulkOperationsTemplateLines',
        userId: user.id,
        entityId: templateId,
        operationCount: {
          create: validated.create?.length || 0,
          update: validated.update?.length || 0,
          delete: deleteIds.length,
        },
        propagateToBudgets: validated.propagateToBudgets,
        propagationImpact: {
          mode: propagationSummary.mode,
          affectedBudgetsCount: propagationSummary.affectedBudgetsCount,
        },
        duration: Date.now() - startTime,
      },
      'Bulk operations on template lines completed successfully',
    );

    return {
      success: true,
      data: {
        created: this.mapper.toApiTemplateLineList(decryptedCreated),
        updated: this.mapper.toApiTemplateLineList(decryptedUpdated),
        deleted: operationsResult.deletedIds,
        propagation: propagationSummary,
      },
    };
  }

  private async handlePropagation(
    templateId: string,
    user: AuthenticatedUser,
    propagateToBudgets: boolean,
    operations: BulkOperationsResult,
    supabase: AuthenticatedSupabaseClient,
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
      return {
        mode: 'propagate',
        affectedBudgetIds: [],
        affectedBudgetsCount: 0,
      };
    }

    return this.propagateToBudgets(templateId, operations, user, supabase);
  }

  private async propagateToBudgets(
    templateId: string,
    operations: BulkOperationsResult,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLinesPropagationSummary> {
    this.logger.info(
      {
        operation: 'propagateTemplateChangesToBudgets',
        templateId,
        userId: user.id,
        operations: {
          deletedCount: operations.deletedIds.length,
          updatedCount: operations.updatedLines.length,
          createdCount: operations.createdLines.length,
        },
      },
      'Starting template propagation to budgets',
    );

    const now = new Date();
    const currentPeriod = {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    };

    const budgets = await this.repo.fetchFutureBudgets(
      templateId,
      user.id,
      currentPeriod,
    );

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
      return {
        mode: 'propagate',
        affectedBudgetIds: [],
        affectedBudgetsCount: 0,
      };
    }

    const impactedBudgetIds = await this.applyRpc(
      templateId,
      budgetIds,
      operations,
    );

    if (impactedBudgetIds.length) {
      await Promise.all(
        impactedBudgetIds.map((id) =>
          this.budgetRecalculation.recalculate(id, supabase, user.clientKey),
        ),
      );
    }

    return {
      mode: 'propagate',
      affectedBudgetIds: impactedBudgetIds,
      affectedBudgetsCount: impactedBudgetIds.length,
    };
  }

  private hasRpcOperations(
    operations: BulkOperationsResult,
    budgetIds: string[],
  ): boolean {
    const hasDeletes = operations.deletedIds.length > 0;
    const hasBudgetMutations =
      budgetIds.length > 0 &&
      (operations.updatedLines.length > 0 ||
        operations.createdLines.length > 0);
    return hasDeletes || hasBudgetMutations;
  }

  private mapLinesForRpc(lines: Tables<'template_line'>[]) {
    return lines.map((line) => ({
      id: line.id,
      name: line.name,
      amount: line.amount,
      kind: line.kind,
      recurrence: line.recurrence,
      original_amount: line.original_amount,
      original_currency: line.original_currency,
      target_currency: line.target_currency,
      exchange_rate: line.exchange_rate,
    }));
  }

  private async applyRpc(
    templateId: string,
    budgetIds: string[],
    operations: BulkOperationsResult,
  ): Promise<string[]> {
    if (!this.hasRpcOperations(operations, budgetIds)) return [];

    const hasBudgetMutations =
      budgetIds.length > 0 &&
      (operations.updatedLines.length > 0 ||
        operations.createdLines.length > 0);

    const updatedLinesPayload = hasBudgetMutations
      ? applyTemplateLineOperationsListSchema.parse(
          this.mapLinesForRpc(operations.updatedLines),
        )
      : [];
    const createdLinesPayload = hasBudgetMutations
      ? applyTemplateLineOperationsListSchema.parse(
          this.mapLinesForRpc(operations.createdLines),
        )
      : [];

    return this.repo.applyTemplateLineOperationsRpc({
      template_id: templateId,
      budget_ids: budgetIds,
      delete_ids: operations.deletedIds,
      updated_lines: updatedLinesPayload,
      created_lines: createdLinesPayload,
    });
  }

  private async performBulkUpdates(
    updates: TemplateLineUpdateWithId[],
    templateId: string,
    user: AuthenticatedUser,
  ): Promise<Tables<'template_line'>[]> {
    if (!updates.length) return [];

    const updateIds = updates.map((u) => u.id);
    await this.repo.validateLinesExist(templateId, updateIds);

    const prepared = await Promise.all(
      updates.map(async (line) => {
        const { id, ...rawUpdateData } = line;
        const updateData =
          await this.currencyService.overrideExchangeRate(rawUpdateData);

        const [encryptedAmount, encryptedOriginalAmount] = await Promise.all([
          updateData.amount !== undefined
            ? this.encryption
                .prepareAmountData(updateData.amount, user.id, user.clientKey)
                .then((p) => p.amount)
            : Promise.resolve(undefined),
          updateData.originalAmount !== undefined
            ? this.encryption.encryptOptionalAmount(
                updateData.originalAmount,
                user.id,
                user.clientKey,
              )
            : Promise.resolve(undefined),
        ]);

        const dbData: Partial<TablesInsert<'template_line'>> = {
          ...this.mapper.toDbTemplateLineUpdate(updateData, encryptedAmount),
          ...(encryptedAmount !== undefined && { amount: encryptedAmount }),
          ...(encryptedOriginalAmount !== undefined && {
            original_amount: encryptedOriginalAmount,
          }),
        };

        return { id, dbData };
      }),
    );

    const updateGroups = new Map<
      string,
      { ids: string[]; data: Partial<TablesInsert<'template_line'>> }
    >();

    for (const { id, dbData } of prepared) {
      const key = JSON.stringify(dbData);
      if (!updateGroups.has(key)) {
        updateGroups.set(key, { ids: [], data: dbData });
      }
      updateGroups.get(key)!.ids.push(id);
    }

    const results = await Promise.all(
      Array.from(updateGroups.values()).map(({ ids, data }) =>
        this.repo.updateLinesInBatch(ids, data),
      ),
    );

    return results.flat();
  }

  private async performBulkCreates(
    creates: TemplateLineCreateWithoutTemplateId[],
    templateId: string,
    user: AuthenticatedUser,
  ): Promise<Tables<'template_line'>[]> {
    if (!creates.length) return [];

    const overriddenCreates = await Promise.all(
      creates.map((line) => this.currencyService.overrideExchangeRate(line)),
    );

    const amounts = overriddenCreates.map((line) => line.amount);
    const preparedAmounts = await this.encryption.prepareAmountsData(
      amounts,
      user.id,
      user.clientKey,
    );

    const encryptedOriginalAmounts = await Promise.all(
      overriddenCreates.map((line) =>
        this.encryption.encryptOptionalAmount(
          line.originalAmount,
          user.id,
          user.clientKey,
        ),
      ),
    );

    const inserts = overriddenCreates.map((line, index) => ({
      ...this.mapper.toDbTemplateLineInsert(
        line,
        templateId,
        preparedAmounts[index].amount,
      ),
      amount: preparedAmounts[index].amount,
      original_amount: encryptedOriginalAmounts[index],
    }));

    return this.repo.insertLines(inserts);
  }
}
