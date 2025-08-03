import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { GetBudgetTemplateQuery } from '../queries/get-budget-template.query';
import {
  BudgetTemplateRepository,
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-template.repository';
import { BudgetTemplate } from '../../domain/entities/budget-template.entity';

@Injectable()
@QueryHandler(GetBudgetTemplateQuery)
export class GetBudgetTemplateHandler
  implements IQueryHandler<GetBudgetTemplateQuery>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GetBudgetTemplateHandler.name);
  }

  async execute(
    query: GetBudgetTemplateQuery,
  ): Promise<Result<BudgetTemplate | null>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'get-budget-template.start',
      userId: query.userId,
      templateId: query.id,
    });

    try {
      const result = await this.templateRepository.findById(
        query.id,
        query.userId,
      );

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'get-budget-template.failed',
          userId: query.userId,
          templateId: query.id,
          error: result.error.message,
          duration,
        });
        return result;
      }

      const template = result.getValue();

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'get-budget-template.success',
        userId: query.userId,
        templateId: query.id,
        found: template !== null,
        duration,
      });

      return Result.ok(template);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'get-budget-template.error',
        userId: query.userId,
        templateId: query.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to get budget template',
          'GET_TEMPLATE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
