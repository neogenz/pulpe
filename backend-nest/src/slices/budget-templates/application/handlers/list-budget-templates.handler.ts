import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { ListBudgetTemplatesQuery } from '../queries/list-budget-templates.query';
import {
  BudgetTemplateRepository,
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-template.repository';
import { BudgetTemplate } from '../../domain/entities/budget-template.entity';

@Injectable()
@QueryHandler(ListBudgetTemplatesQuery)
export class ListBudgetTemplatesHandler
  implements IQueryHandler<ListBudgetTemplatesQuery>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ListBudgetTemplatesHandler.name);
  }

  async execute(
    query: ListBudgetTemplatesQuery,
  ): Promise<Result<BudgetTemplate[]>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'list-budget-templates.start',
      userId: query.userId,
    });

    try {
      // Get all templates for the user
      const templatesResult = await this.templateRepository.findByUserId(
        query.userId,
      );
      if (templatesResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'list-budget-templates.fetch-failed',
          userId: query.userId,
          error: templatesResult.error.message,
          duration,
        });
        return Result.fail(templatesResult.error);
      }

      const templates = templatesResult.getValue();

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'list-budget-templates.success',
        userId: query.userId,
        templatesCount: templates.length,
        duration,
      });

      return Result.ok(templates);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'list-budget-templates.error',
        userId: query.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to list budget templates',
          'LIST_TEMPLATES_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
