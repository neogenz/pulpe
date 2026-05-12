import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetTemplateDeleteResponse } from 'pulpe-shared';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateInvariants } from '../domain/budget-template.invariants';

@Injectable()
export class RemoveTemplateUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @InjectInfoLogger(RemoveTemplateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<BudgetTemplateDeleteResponse> {
    const startTime = Date.now();

    await this.repo.validateAccess(id, user.id);

    const isInUse = await this.repo.isTemplateInUse(id);
    BudgetTemplateInvariants.validateTemplateNotUsed(id, isInUse ? 1 : 0);

    await this.repo.delete(id);

    this.logger.info(
      {
        operation: 'remove',
        userId: user.id,
        entityId: id,
        duration: Date.now() - startTime,
      },
      'Template deleted successfully',
    );

    return { success: true, message: 'Template deleted successfully' };
  }
}
