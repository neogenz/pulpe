import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetTemplateResponse } from 'pulpe-shared';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';

@Injectable()
export class FindTemplateUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(FindTemplateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<BudgetTemplateResponse> {
    const startTime = Date.now();

    await this.repo.validateAccess(id, user.id);
    const data = await this.repo.findById(id, user.id);

    this.logger.info(
      {
        operation: 'findOne',
        userId: user.id,
        entityId: id,
        duration: Date.now() - startTime,
      },
      'Template retrieved successfully',
    );

    return { success: true, data: this.mapper.toApiTemplate(data) };
  }
}
