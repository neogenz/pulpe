import { Inject, Injectable } from '@nestjs/common';
import type { BudgetCreate, BudgetDeletionImpact } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { BudgetWritePort } from '../domain/ports/budget-write.port';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type { Budget } from '../domain/budget.entity';
import { CreateBudgetUseCase } from './create-budget.use-case';
import { RemoveBudgetUseCase } from './remove-budget.use-case';
import { GetBudgetDeletionImpactUseCase } from './get-budget-deletion-impact.use-case';

/** Month creation and deletion, for in-process consumers that have no HTTP request. */
@Injectable()
export class WriteBudgetsInProcessUseCase implements BudgetWritePort {
  constructor(
    private readonly createBudget: CreateBudgetUseCase,
    private readonly removeBudget: RemoveBudgetUseCase,
    private readonly getDeletionImpact: GetBudgetDeletionImpactUseCase,
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  createFromTemplate(dto: BudgetCreate): Promise<Budget> {
    return this.createBudget.execute(dto, this.session.user);
  }

  async deletionImpact(
    month: number,
    year: number,
  ): Promise<BudgetDeletionImpact> {
    return this.getDeletionImpact.execute(
      await this.#budgetId(month, year),
      this.session.user,
    );
  }

  async removeMonth(
    month: number,
    year: number,
    confirmLinks: boolean,
  ): Promise<BudgetDeletionImpact> {
    return this.removeBudget.execute(
      await this.#budgetId(month, year),
      this.session.user,
      confirmLinks,
    );
  }

  async #budgetId(month: number, year: number): Promise<string> {
    const id = await this.repo.fetchBudgetIdByPeriod(month, year);
    if (id === null) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        undefined,
        {
          operation: 'budget.findIdByPeriod',
          userId: this.session.user.id,
          month,
          year,
        },
      );
    }
    return id;
  }
}
