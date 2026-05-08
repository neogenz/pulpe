import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
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
    _supabase: unknown,
  ): Promise<BudgetTemplateResponse> {
    const startTime = Date.now();

    await this.repo.validateAccess(id, user.id);
    const validated = budgetTemplateUpdateSchema.parse(updateDto);

    if (validated.isDefault) {
      await this.repo.resetDefaultTemplates(user.id, id);
    }

    const data = await this.repo.update(id, {
      name: validated.name,
      description: validated.description,
      isDefault: validated.isDefault,
    });

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
