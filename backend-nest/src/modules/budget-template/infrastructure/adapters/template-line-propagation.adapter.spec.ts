import { describe, expect, it, jest } from 'bun:test';
import { BulkTemplateLineOperationsUseCase } from '../../application/bulk-template-line-operations.use-case';
import type { TemplateLine } from '../../domain/budget-template.entity';
import { TemplateLinePropagationAdapter } from './template-line-propagation.adapter';

const input = {
  templateId: 'template-1',
  userId: 'user-1',
  payDayOfMonth: 5,
  savingsGoalId: 'goal-1',
  name: 'Maison',
  amount: 250,
  kind: 'saving' as const,
  recurrence: 'fixed' as const,
};

describe('TemplateLinePropagationAdapter', () => {
  it('delegates creation and propagation to the existing bulk use case', async () => {
    const createdLine = { id: 'line-1' } as TemplateLine;
    const bulkOperations = {
      execute: jest.fn().mockResolvedValue({ createdLines: [createdLine] }),
    };
    const adapter = new TemplateLinePropagationAdapter(
      bulkOperations as unknown as BulkTemplateLineOperationsUseCase,
    );

    const result = await adapter.createLineAndPropagate(input);

    expect(result).toBe(createdLine);
    expect(bulkOperations.execute).toHaveBeenCalledWith(
      'template-1',
      {
        create: [
          {
            name: 'Maison',
            amount: 250,
            kind: 'saving',
            recurrence: 'fixed',
            description: '',
            savingsGoalId: 'goal-1',
          },
        ],
        update: [],
        delete: [],
        propagateToBudgets: true,
      },
      { id: 'user-1', payDayOfMonth: 5 },
    );
  });

  it('identifies the savings goal when the created line is missing', async () => {
    const bulkOperations = {
      execute: jest.fn().mockResolvedValue({ createdLines: [] }),
    };
    const adapter = new TemplateLinePropagationAdapter(
      bulkOperations as unknown as BulkTemplateLineOperationsUseCase,
    );

    expect(adapter.createLineAndPropagate(input)).rejects.toMatchObject({
      loggingContext: {
        operation: 'templateLinePropagation.createLineAndPropagate',
        userId: 'user-1',
        templateId: 'template-1',
        savingsGoalId: 'goal-1',
      },
    });
  });
});
