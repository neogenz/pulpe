import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import type { BudgetTemplate } from '../domain/budget-template.entity';

@Injectable()
export class FindAllTemplatesUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @InjectInfoLogger(FindAllTemplatesUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(user: AuthenticatedUser): Promise<BudgetTemplate[]> {
    const startTime = Date.now();

    const data = await this.repo.findAllForUser(user.id);

    this.logger.info(
      {
        operation: 'findAll',
        userId: user.id,
        duration: Date.now() - startTime,
        count: data.length,
      },
      'Templates retrieved successfully',
    );

    return data;
  }
}
