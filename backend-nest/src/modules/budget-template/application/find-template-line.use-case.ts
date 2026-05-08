import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TemplateLineResponse } from 'pulpe-shared';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';

@Injectable()
export class FindTemplateLineUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(FindTemplateLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    lineId: string,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();

    const { line, templateUserId } = await this.repo.findLineById(lineId);

    if (templateUserId !== user.id) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_LINE_ACCESS_FORBIDDEN,
        { id: lineId },
      );
    }

    this.logger.info(
      {
        operation: 'findTemplateLine',
        userId: user.id,
        entityId: lineId,
        duration: Date.now() - startTime,
      },
      'Template line retrieved successfully',
    );

    return {
      success: true,
      data: this.mapper.toApiTemplateLine(line),
    };
  }
}
