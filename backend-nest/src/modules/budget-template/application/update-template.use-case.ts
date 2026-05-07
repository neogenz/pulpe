import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type BudgetTemplateResponse,
  type BudgetTemplateUpdate,
  budgetTemplateUpdateSchema,
} from 'pulpe-shared';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';

@Injectable()
export class UpdateTemplateUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(UpdateTemplateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    updateDto: BudgetTemplateUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    const startTime = Date.now();

    await this.repo.validateAccess(id, user.id, supabase);
    const validated = budgetTemplateUpdateSchema.parse(updateDto);

    if (validated.isDefault) {
      await this.repo.resetDefaultTemplates(user.id, id, supabase);
    }

    const updateData = this.mapper.toDbTemplateUpdate(validated);
    const data = await this.repo.update(id, updateData, supabase);

    this.logger.info(
      {
        operation: 'update',
        userId: user.id,
        entityId: id,
        duration: Date.now() - startTime,
      },
      'Template updated successfully',
    );

    return { success: true, data: this.mapper.toApiTemplate(data) };
  }
}
