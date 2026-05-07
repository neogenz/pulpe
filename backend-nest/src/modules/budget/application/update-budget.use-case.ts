import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type BudgetUpdate, type BudgetResponse } from 'pulpe-shared';
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
import { BudgetMapper } from '../infrastructure/mappers/budget.mapper';

@Injectable()
export class UpdateBudgetUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    private readonly mapper: BudgetMapper,
    @InjectInfoLogger(UpdateBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: BudgetUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    BudgetInvariants.validateUpdate(dto);

    if (dto.month && dto.year) {
      await this.validateNoDuplicatePeriod(supabase, dto.month, dto.year, id);
    }

    const budget = await this.repo.updateBudget(
      id,
      dto as Record<string, unknown>,
    );

    await this.budgetRecalculation.recalculate(id, user.clientKey);
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { budgetId: id, userId: user.id, operation: 'budget.update' },
      'Budget updated',
    );

    return {
      success: true,
      data: this.mapper.toApi(budget as Parameters<BudgetMapper['toApi']>[0]),
    };
  }

  private async validateNoDuplicatePeriod(
    supabase: AuthenticatedSupabaseClient,
    month: number,
    year: number,
    excludeId: string,
  ): Promise<void> {
    const { data: existingBudget } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('month', month)
      .eq('year', year)
      .neq('id', excludeId)
      .single();

    if (existingBudget) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        { month, year },
      );
    }
  }
}
