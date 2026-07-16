import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type {
  LinkedTemplateLineCreateInput,
  TemplateLinePropagationPort,
} from '../domain/ports/template-line-propagation.port';
import type { TemplateLine } from '../domain/budget-template.entity';
import { BulkTemplateLineOperationsUseCase } from './bulk-template-line-operations.use-case';

@Injectable()
export class TemplateLinePropagationAdapter implements TemplateLinePropagationPort {
  constructor(
    private readonly bulkOperations: BulkTemplateLineOperationsUseCase,
  ) {}

  async createLineAndPropagate(
    input: LinkedTemplateLineCreateInput,
  ): Promise<TemplateLine> {
    const result = await this.bulkOperations.execute(
      input.templateId,
      {
        create: [
          {
            name: input.name,
            amount: input.amount,
            kind: input.kind,
            recurrence: input.recurrence,
            description: '',
            savingsGoalId: input.savingsGoalId,
          },
        ],
        update: [],
        delete: [],
        propagateToBudgets: true,
      },
      { id: input.userId },
    );

    const [createdLine] = result.createdLines;
    if (!createdLine) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_UPDATE_FAILED,
        { id: input.templateId },
        {
          operation: 'templateLinePropagation.createLineAndPropagate',
          userId: input.userId,
          templateId: input.templateId,
        },
      );
    }
    return createdLine;
  }
}
