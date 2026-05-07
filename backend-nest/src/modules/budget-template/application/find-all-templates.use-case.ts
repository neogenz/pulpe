import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetTemplateListResponse } from 'pulpe-shared';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';

@Injectable()
export class FindAllTemplatesUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(FindAllTemplatesUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateListResponse> {
    const startTime = Date.now();

    const data = await this.repo.findAllForUser(user.id, supabase);

    this.logger.info(
      {
        operation: 'findAll',
        userId: user.id,
        duration: Date.now() - startTime,
        count: data.length,
      },
      'Templates retrieved successfully',
    );

    return { success: true, data: this.mapper.toApiTemplateList(data) };
  }
}
