import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
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
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineDeleteResponse> {
    const startTime = Date.now();

    await this.repo.validateLineAccess(lineId, user.id, supabase);
    await this.repo.deleteLine(lineId, supabase);

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
