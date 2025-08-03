import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { GetTemplateLinesQuery } from '../queries/get-template-lines.query';
import {
  BudgetTemplateRepository,
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-template.repository';
import { TemplateLine } from '../../domain/value-objects/template-line.value-object';

@Injectable()
@QueryHandler(GetTemplateLinesQuery)
export class GetTemplateLinesHandler
  implements IQueryHandler<GetTemplateLinesQuery>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GetTemplateLinesHandler.name);
  }

  async execute(query: GetTemplateLinesQuery): Promise<Result<TemplateLine[]>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'get-template-lines.start',
      userId: query.userId,
      templateId: query.templateId,
    });

    try {
      // Verify template exists
      const existsResult = await this.templateRepository.exists(
        query.templateId,
        query.userId,
      );
      if (existsResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'get-template-lines.exists-check-failed',
          userId: query.userId,
          templateId: query.templateId,
          error: existsResult.error.message,
          duration,
        });
        return Result.fail(existsResult.error);
      }

      if (!existsResult.getValue()) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'get-template-lines.template-not-found',
          userId: query.userId,
          templateId: query.templateId,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Budget template not found',
            'TEMPLATE_NOT_FOUND',
            `Template with ID ${query.templateId} not found`,
          ),
        );
      }

      // Get template lines
      const linesResult = await this.templateRepository.findLinesByTemplateId(
        query.templateId,
        query.userId,
      );
      if (linesResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'get-template-lines.fetch-failed',
          userId: query.userId,
          templateId: query.templateId,
          error: linesResult.error.message,
          duration,
        });
        return Result.fail(linesResult.error);
      }

      const lines = linesResult.getValue();

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'get-template-lines.success',
        userId: query.userId,
        templateId: query.templateId,
        linesCount: lines.length,
        duration,
      });

      return Result.ok(lines);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'get-template-lines.error',
        userId: query.userId,
        templateId: query.templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to get template lines',
          'GET_LINES_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
