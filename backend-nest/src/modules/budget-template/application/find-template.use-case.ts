import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import type { BudgetTemplate } from '../domain/budget-template.entity';

@Injectable()
export class FindTemplateUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @InjectInfoLogger(FindTemplateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<BudgetTemplate> {
    const startTime = Date.now();

    const data = await this.repo.validateAccess(id, user.id);

    this.logger.info(
      {
        operation: 'findOne',
        userId: user.id,
        entityId: id,
        duration: Date.now() - startTime,
      },
      'Template retrieved successfully',
    );

    return data;
  }
}
