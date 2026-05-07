import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';

@Injectable()
export class CheckTemplateUsageUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @InjectInfoLogger(CheckTemplateUsageUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{
    success: boolean;
    data: {
      isUsed: boolean;
      budgetCount: number;
      budgets: Array<{
        id: string;
        month: number;
        year: number;
        description: string;
      }>;
    };
  }> {
    const startTime = Date.now();

    await this.repo.validateAccess(id, user.id, supabase);
    const budgets = await this.repo.fetchTemplateBudgets(id, supabase);

    this.logger.info(
      {
        operation: 'checkTemplateUsage',
        userId: user.id,
        entityId: id,
        duration: Date.now() - startTime,
        budgetCount: budgets.length,
      },
      'Template usage checked successfully',
    );

    return {
      success: true,
      data: {
        isUsed: budgets.length > 0,
        budgetCount: budgets.length,
        budgets,
      },
    };
  }
}
