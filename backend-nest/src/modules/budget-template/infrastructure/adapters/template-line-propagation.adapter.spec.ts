import { describe, expect, it, jest } from 'bun:test';
import { BulkTemplateLineOperationsUseCase } from '../../application/bulk-template-line-operations.use-case';
import { TemplateLinePropagationAdapter } from './template-line-propagation.adapter';

describe('TemplateLinePropagationAdapter', () => {
  it('identifies the savings goal when the created line is missing', async () => {
    const bulkOperations = {
      execute: jest.fn().mockResolvedValue({ createdLines: [] }),
    };
    const adapter = new TemplateLinePropagationAdapter(
      bulkOperations as unknown as BulkTemplateLineOperationsUseCase,
    );

    expect(
      adapter.createLineAndPropagate({
        templateId: 'template-1',
        userId: 'user-1',
        savingsGoalId: 'goal-1',
        name: 'Maison',
        amount: 250,
        kind: 'saving',
        recurrence: 'fixed',
      }),
    ).rejects.toMatchObject({
      loggingContext: {
        operation: 'templateLinePropagation.createLineAndPropagate',
        userId: 'user-1',
        templateId: 'template-1',
        savingsGoalId: 'goal-1',
      },
    });
  });
});
