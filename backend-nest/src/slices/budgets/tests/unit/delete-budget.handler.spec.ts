import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { DeleteBudgetHandler } from '../../application/handlers/delete-budget.handler';
import { DeleteBudgetCommand } from '../../application/commands/delete-budget.command';
import type { BudgetRepository } from '../../domain/repositories';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { Result } from '@shared/domain/enhanced-result';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import { DomainException } from '@shared/domain/exceptions/domain.exception';

describe('DeleteBudgetHandler', () => {
  let handler: DeleteBudgetHandler;
  let mockRepository: BudgetRepository;
  let mockLogger: EnhancedLoggerService;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      findById: mock(() => Promise.resolve(Result.ok(null))),
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

    handler = new DeleteBudgetHandler(mockRepository, mockLogger);
  });

  describe('execute', () => {
    it('should delete budget successfully', async () => {
      // Create a future budget that can be deleted
      const futurePeriod = BudgetPeriod.create(
        1,
        new Date().getFullYear() + 1,
      ).value!;
      const futureBudget = Budget.create(
        {
          userId: 'user-123',
          period: futurePeriod,
          description: 'Future Budget',
          templateId: 'template-123',
        },
        'budget-123',
      ).value!;

      mockRepository.findById = mock(() =>
        Promise.resolve(Result.ok(futureBudget)),
      );

      const command = new DeleteBudgetCommand('budget-123', 'user-123');
      const result = await handler.execute(command);

      expect(result.isOk()).toBe(true);
      expect(result.value).toEqual({
        success: true,
        message: 'Budget deleted successfully',
      });
      expect(mockRepository.delete).toHaveBeenCalledWith(
        'budget-123',
        'user-123',
      );
    });

    it('should delete current month budget', async () => {
      // Create current month budget
      const now = new Date();
      const currentPeriod = BudgetPeriod.create(
        now.getMonth() + 1,
        now.getFullYear(),
      ).value!;
      const currentBudget = Budget.create(
        {
          userId: 'user-123',
          period: currentPeriod,
          description: 'Current Budget',
          templateId: 'template-123',
        },
        'budget-123',
      ).value!;

      mockRepository.findById = mock(() =>
        Promise.resolve(Result.ok(currentBudget)),
      );

      const command = new DeleteBudgetCommand('budget-123', 'user-123');
      const result = await handler.execute(command);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalled();
    });

    it('should fail if budget not found', async () => {
      mockRepository.findById = mock(() => Promise.resolve(Result.ok(null)));

      const command = new DeleteBudgetCommand('budget-123', 'user-123');
      const result = await handler.execute(command);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Budget not found');
      expect(result.error?.code).toBe('BUDGET_NOT_FOUND');
    });

    it('should fail if user does not own the budget', async () => {
      const period = BudgetPeriod.create(1, 2024).value!;
      const budget = Budget.create(
        {
          userId: 'other-user',
          period,
          description: 'Budget',
          templateId: 'template-123',
        },
        'budget-123',
      ).value!;

      mockRepository.findById = mock(() => Promise.resolve(Result.ok(budget)));

      const command = new DeleteBudgetCommand('budget-123', 'user-123');
      const result = await handler.execute(command);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toBe('Unauthorized');
      expect(result.error?.code).toBe('UNAUTHORIZED_ACCESS');
    });

    it('should fail if budget cannot be deleted (past budget)', async () => {
      // Create a past budget
      const pastPeriod = BudgetPeriod.create(1, 2020).value!;
      const pastBudget = Budget.create(
        {
          userId: 'user-123',
          period: pastPeriod,
          description: 'Past Budget',
          templateId: 'template-123',
        },
        'budget-123',
      ).value!;

      mockRepository.findById = mock(() =>
        Promise.resolve(Result.ok(pastBudget)),
      );

      const command = new DeleteBudgetCommand('budget-123', 'user-123');
      const result = await handler.execute(command);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toBe('Budget cannot be deleted');
      expect(result.error?.code).toBe('BUDGET_NOT_DELETABLE');
    });

    it('should log operation with correct context', async () => {
      const futurePeriod = BudgetPeriod.create(
        1,
        new Date().getFullYear() + 1,
      ).value!;
      const futureBudget = Budget.create(
        {
          userId: 'user-123',
          period: futurePeriod,
          description: 'Future Budget',
          templateId: 'template-123',
        },
        'budget-123',
      ).value!;

      mockRepository.findById = mock(() =>
        Promise.resolve(Result.ok(futureBudget)),
      );

      const command = new DeleteBudgetCommand('budget-123', 'user-123');
      await handler.execute(command);

      expect(mockLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'DeleteBudget',
          context: expect.objectContaining({
            budgetId: 'budget-123',
            userId: 'user-123',
          }),
        }),
      );
    });

    it('should publish BudgetDeletedEvent on success', async () => {
      const futurePeriod = BudgetPeriod.create(
        1,
        new Date().getFullYear() + 1,
      ).value!;
      const futureBudget = Budget.create(
        {
          userId: 'user-123',
          period: futurePeriod,
          description: 'Future Budget',
          templateId: 'template-123',
        },
        'budget-123',
      ).value!;

      mockRepository.findById = mock(() =>
        Promise.resolve(Result.ok(futureBudget)),
      );

      const command = new DeleteBudgetCommand('budget-123', 'user-123');
      await handler.execute(command);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            budgetId: 'budget-123',
            userId: 'user-123',
            month: futurePeriod.month,
            year: futurePeriod.year,
          }),
        }),
        'BudgetDeletedEvent published',
      );
    });

    it('should handle repository delete failure', async () => {
      const futurePeriod = BudgetPeriod.create(
        1,
        new Date().getFullYear() + 1,
      ).value!;
      const futureBudget = Budget.create(
        {
          userId: 'user-123',
          period: futurePeriod,
          description: 'Future Budget',
          templateId: 'template-123',
        },
        'budget-123',
      ).value!;

      mockRepository.findById = mock(() =>
        Promise.resolve(Result.ok(futureBudget)),
      );
      mockRepository.delete = mock(() =>
        Promise.resolve(Result.fail(new Error('Database error'))),
      );

      const command = new DeleteBudgetCommand('budget-123', 'user-123');
      const result = await handler.execute(command);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Database error');
    });
  });
});
