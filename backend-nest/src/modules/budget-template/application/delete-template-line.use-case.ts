import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TemplateLineDeleteResponse } from 'pulpe-shared';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';

@Injectable()
export class DeleteTemplateLineUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @InjectInfoLogger(DeleteTemplateLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    lineId: string,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<TemplateLineDeleteResponse> {
    const startTime = Date.now();

    await this.repo.validateLineAccess(lineId, user.id);
    await this.repo.deleteLine(lineId);

    this.logger.info(
      {
        operation: 'deleteTemplateLine',
        userId: user.id,
        entityId: lineId,
        duration: Date.now() - startTime,
      },
      'Template line deleted successfully',
    );

    return { success: true, message: 'Template line deleted successfully' };
  }
}
