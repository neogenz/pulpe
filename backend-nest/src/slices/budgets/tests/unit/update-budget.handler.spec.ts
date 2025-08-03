import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { UpdateBudgetHandler } from '../../application/handlers/update-budget.handler';
import { UpdateBudgetCommand } from '../../application/commands/update-budget.command';
import type { BudgetRepository } from '../../domain/repositories';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { Result } from '@shared/domain/enhanced-result';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import { DomainException } from '@shared/domain/exceptions/domain.exception';

describe('UpdateBudgetHandler', () => {
  let handler: UpdateBudgetHandler;
  let mockRepository: BudgetRepository;
  let mockLogger: EnhancedLoggerService;
  let mockBudget: Budget;

  // Use consistent future dates for testing
  const futureYear = new Date().getFullYear() + 1;
  const futureMonth = 6; // June of next year

  beforeEach(() => {
    // Create a mock budget with future date
    const period = BudgetPeriod.create(futureMonth, futureYear).value!;
    mockBudget = Budget.create(
      {
        userId: 'user-123',
        period,
        description: 'Original Description',
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

    handler = new UpdateBudgetHandler(mockRepository, mockLogger);
  });

  describe('execute', () => {
    it('should update description successfully', async () => {
      const command = new UpdateBudgetCommand(
        'budget-123',
        'user-123',
        'Updated Description',
      );

      const result = await handler.execute(command);

      expect(result.isOk()).toBe(true);
      expect(result.value?.description).toBe('Updated Description');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should update period successfully', async () => {
      const newMonth = 7; // July
      const command = new UpdateBudgetCommand(
        'budget-123',
        'user-123',
        undefined,
        newMonth,
        futureYear,
      );

      const result = await handler.execute(command);

      expect(result.isOk()).toBe(true);
      expect(result.value?.month).toBe(newMonth);
      expect(result.value?.year).toBe(futureYear);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should update both description and period', async () => {
      const newMonth = 8; // August
      const command = new UpdateBudgetCommand(
        'budget-123',
        'user-123',
        'New Description',
        newMonth,
        futureYear,
      );

      const result = await handler.execute(command);

      expect(result.isOk()).toBe(true);
      expect(result.value?.description).toBe('New Description');
      expect(result.value?.month).toBe(newMonth);
      expect(result.value?.year).toBe(futureYear);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should fail if budget not found', async () => {
      mockRepository.findById = mock(() => Promise.resolve(Result.ok(null)));

      const command = new UpdateBudgetCommand(
        'budget-123',
        'user-123',
        'Updated',
      );

      const result = await handler.execute(command);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Budget not found');
    });

    it('should fail if user does not own the budget', async () => {
      const command = new UpdateBudgetCommand(
        'budget-123',
        'other-user', // Different user
        'Updated',
      );

      const result = await handler.execute(command);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toBe('Unauthorized');
    });

    it('should fail if budget is not editable (past budget)', async () => {
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

      const command = new UpdateBudgetCommand(
        'budget-123',
        'user-123',
        'Updated',
      );

      const result = await handler.execute(command);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toBe('Budget not editable');
    });

    it('should fail if period already exists for another budget', async () => {
      mockRepository.existsForPeriod = mock(() =>
        Promise.resolve(Result.ok(true)),
      );

      const command = new UpdateBudgetCommand(
        'budget-123',
        'user-123',
        undefined,
        7,
        futureYear,
      );

      const result = await handler.execute(command);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toBe(
        'Budget already exists for this period',
      );
    });

    it('should log operation with correct context', async () => {
      const command = new UpdateBudgetCommand(
        'budget-123',
        'user-123',
        'Updated',
      );

      await handler.execute(command);

      expect(mockLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'UpdateBudget',
          context: expect.objectContaining({
            budgetId: 'budget-123',
            userId: 'user-123',
          }),
        }),
      );
    });

    it('should not save if no changes made', async () => {
      const command = new UpdateBudgetCommand(
        'budget-123',
        'user-123',
        // No updates provided
      );

      const result = await handler.execute(command);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should publish BudgetUpdatedEvent on success', async () => {
      const command = new UpdateBudgetCommand(
        'budget-123',
        'user-123',
        'Updated Description',
      );

      await handler.execute(command);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            budgetId: 'budget-123',
            userId: 'user-123',
            changes: { description: 'Updated Description' },
          }),
        }),
        'BudgetUpdatedEvent published',
      );
    });
  });
});
