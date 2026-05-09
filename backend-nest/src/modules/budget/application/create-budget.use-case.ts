import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type BudgetCreate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '../domain/ports/budget-recalculation.port';
import { BudgetInvariants } from '../domain/budget.invariants';
import type { Budget } from '../domain/budget.entity';

@Injectable()
export class CreateBudgetUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(CreateBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(dto: BudgetCreate, user: AuthenticatedUser): Promise<Budget> {
    BudgetInvariants.validateCreate(dto);

    await this.validateNoDuplicatePeriod(dto.month, dto.year);

    const startTime = Date.now();
    this.logger.info(
      {
        userId: user.id,
        templateId: dto.templateId,
        period: `${dto.month}/${dto.year}`,
        operation: 'budget.create.start',
      },
      'Starting budget creation from template',
    );

    const rpcResult = await this.executeBudgetCreationRpc(dto, user);

    // Cache invalidation BEFORE recalc — if recalc fails, the stale list
    // cache (without the new budget) won't survive the failed write while
    // the budget already exists in DB via the atomic RPC.
    await this.cacheService.invalidateForUser(user.id);

    try {
      await this.budgetRecalculation.recalculate(
        rpcResult.budget.id,
        user.clientKey,
      );
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
        undefined,
        {
          operation: 'budget.create.recalcAfterRpc',
          severity: 'critical',
          partialFailure: true,
          budgetId: rpcResult.budget.id,
          userId: user.id,
          templateId: dto.templateId,
        },
        { cause },
      );
    }

    const budget = await this.repo.fetchBudgetById(
      rpcResult.budget.id,
      user.id,
    );

    this.logger.info(
      {
        userId: user.id,
        budgetId: budget.id,
        templateId: dto.templateId,
        templateName: rpcResult.template_name,
        period: `${dto.month}/${dto.year}`,
        linesCreated: rpcResult.budget_lines_created,
        duration: Date.now() - startTime,
        operation: 'budget.create.success',
      },
      'Budget created from template with atomic transaction',
    );

    return budget;
  }

  private async executeBudgetCreationRpc(
    dto: BudgetCreate,
    user: AuthenticatedUser,
  ) {
    try {
      return await this.repo.createBudgetFromTemplateRpc({
        p_user_id: user.id,
        p_template_id: dto.templateId!,
        p_month: dto.month,
        p_year: dto.year,
        p_description: dto.description,
      });
    } catch (error) {
      throw this.mapPostgreSQLErrorToBusinessException(
        error,
        user.id,
        dto.templateId!,
      );
    }
  }

  private mapPostgreSQLErrorToBusinessException(
    error: unknown,
    userId: string,
    templateId: string,
  ): BusinessException {
    if (error instanceof BusinessException) {
      return error;
    }

    const errorObj = error as { code?: string; message?: string };
    const errorCode = errorObj?.code;
    const errorMessage = errorObj?.message || '';

    if (errorCode === '23505') {
      return new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        undefined,
        { userId, templateId },
      );
    }

    if (errorCode === '23503') {
      return new BusinessException(ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND, {
        id: templateId,
      });
    }

    if (errorCode === 'P0001') {
      if (errorMessage.includes('Budget already exists for this period')) {
        return new BusinessException(
          ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
          undefined,
          { userId, templateId },
        );
      }
      if (
        errorMessage.includes('Template not found') ||
        errorMessage.includes('access denied')
      ) {
        return new BusinessException(ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND, {
          id: templateId,
        });
      }
    }

    return new BusinessException(
      ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
      undefined,
      { userId, templateId },
      { cause: error },
    );
  }

  private async validateNoDuplicatePeriod(
    month: number,
    year: number,
  ): Promise<void> {
    const existingId = await this.repo.fetchBudgetIdByPeriod(month, year);
    if (existingId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        { month, year },
      );
    }
  }
}
