import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import type { TemplateLine } from '../domain/budget-template.entity';

@Injectable()
export class FindTemplateLinesUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @InjectInfoLogger(FindTemplateLinesUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    templateId: string,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<TemplateLine[]> {
    const startTime = Date.now();

    await this.repo.validateAccess(templateId, user.id);
    const lines = await this.repo.findLinesByTemplateId(templateId);

    this.logger.info(
      {
        operation: 'findTemplateLines',
        userId: user.id,
        entityId: templateId,
        duration: Date.now() - startTime,
        lineCount: lines.length,
      },
      'Template lines retrieved successfully',
    );

    return lines;
  }
}
