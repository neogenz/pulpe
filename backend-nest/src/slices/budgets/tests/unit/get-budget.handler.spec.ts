import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { GetBudgetHandler } from '../../application/handlers/get-budget.handler';
import { GetBudgetQuery } from '../../application/queries/get-budget.query';
import type { BudgetRepository } from '../../domain/repositories';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { Result } from '@shared/domain/enhanced-result';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';

describe('GetBudgetHandler', () => {
  let handler: GetBudgetHandler;
  let mockRepository: BudgetRepository;
  let mockLogger: EnhancedLoggerService;
  let mockBudget: Budget;

  beforeEach(() => {
    // Create a mock budget
    const period = BudgetPeriod.create(1, 2024).value!;
    mockBudget = Budget.create(
      {
        userId: 'user-123',
        period,
        description: 'Test Budget',
        templateId: 'template-123',
      },
      'budget-123',
    ).value!;

    // Create mock repository
    mockRepository = {
      findById: mock(() => Promise.resolve(Result.ok(mockBudget))),
      findByPeriod: mock(() => Promise.resolve(Result.ok(null))),
      findByUserId: mock(() => Promise.resolve(Result.ok([]))),
      existsForPeriod: mock(() => Promise.resolve(Result.ok(false))),
      save: mock(() => Promise.resolve(Result.ok())),
      delete: mock(() => Promise.resolve(Result.ok())),
      createFromTemplate: mock(() =>
        Promise.resolve(Result.ok({ budgetLinesCreated: 5 })),
      ),
    };

    // Create mock logger
    mockLogger = {
      info: mock(() => {}),
      error: mock(() => {}),
      warn: mock(() => {}),
      debug: mock(() => {}),
      child: mock(() => mockLogger),
      logOperation: mock(async ({ logFn }) => {
        // Execute the actual operation function
        return await logFn();
      }),
    } as any;

    handler = new GetBudgetHandler(mockRepository, mockLogger);
  });

  describe('execute', () => {
    it('should get budget successfully', async () => {
      const query = new GetBudgetQuery('budget-123', 'user-123');
      const result = await handler.execute(query);

      expect(result.isOk()).toBe(true);
      expect(result.value).toEqual({
        id: 'budget-123',
        userId: 'user-123',
        month: 1,
        year: 2024,
        description: 'Test Budget',
        templateId: 'template-123',
        createdAt: mockBudget.createdAt,
        updatedAt: mockBudget.updatedAt,
      });
    });

    it('should fail if budget not found', async () => {
      mockRepository.findById = mock(() => Promise.resolve(Result.ok(null)));

      const query = new GetBudgetQuery('budget-123', 'user-123');
      const result = await handler.execute(query);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Budget not found');
    });

    it('should log operation with correct context', async () => {
      const query = new GetBudgetQuery('budget-123', 'user-123');
      await handler.execute(query);

      expect(mockLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'GetBudget',
          context: expect.objectContaining({
            budgetId: 'budget-123',
            userId: 'user-123',
          }),
        }),
      );
    });

    it('should handle repository errors', async () => {
      mockRepository.findById = mock(() =>
        Promise.resolve(Result.fail('Database error')),
      );

      const query = new GetBudgetQuery('budget-123', 'user-123');
      const result = await handler.execute(query);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Database error');
    });

    it('should log error when operation fails', async () => {
      // Make the repository throw an error
      mockRepository.findById = mock(() =>
        Promise.reject(new Error('Connection failed')),
      );

      const query = new GetBudgetQuery('budget-123', 'user-123');
      await handler.execute(query);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          context: expect.objectContaining({
            budgetId: 'budget-123',
            userId: 'user-123',
          }),
        }),
        'Failed to get budget',
      );
    });
  });
});
