import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import type { BudgetLine } from '../domain/budget-line.entity';

@Injectable()
export class FindAllBudgetLinesUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @InjectInfoLogger(FindAllBudgetLinesUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    user: AuthenticatedUser,
    _supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLine[]> {
    const entities = await this.repo.findAll();

    this.logger.info(
      {
        userId: user.id,
        count: entities.length,
        operation: 'budgetLine.findAll',
      },
      'Budget lines fetched',
    );

    return entities;
  }
}
