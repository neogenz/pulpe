import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ListBudgetsHandler } from '../../application/handlers/list-budgets.handler';
import { ListBudgetsQuery } from '../../application/queries/list-budgets.query';
import type { BudgetRepository } from '../../domain/repositories';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { Result } from '@shared/domain/enhanced-result';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';

describe('ListBudgetsHandler', () => {
  let handler: ListBudgetsHandler;
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

    handler = new ListBudgetsHandler(mockRepository, mockLogger);
  });

  describe('execute', () => {
    it('should list budgets successfully', async () => {
      // Create mock budgets
      const budget1 = Budget.create(
        {
          userId: 'user-123',
          period: BudgetPeriod.create(1, 2024).value!,
          description: 'January Budget',
          templateId: 'template-123',
        },
        'budget-1',
      ).value!;

      const budget2 = Budget.create(
        {
          userId: 'user-123',
          period: BudgetPeriod.create(2, 2024).value!,
          description: 'February Budget',
          templateId: 'template-123',
        },
        'budget-2',
      ).value!;

      const budget3 = Budget.create(
        {
          userId: 'user-123',
          period: BudgetPeriod.create(12, 2023).value!,
          description: 'December Budget',
          templateId: 'template-123',
        },
        'budget-3',
      ).value!;

      mockRepository.findByUserId = mock(() =>
        Promise.resolve(Result.ok([budget1, budget2, budget3])),
      );

      const query = new ListBudgetsQuery('user-123');
      const result = await handler.execute(query);

      expect(result.isOk()).toBe(true);
      expect(result.value).toHaveLength(3);

      // Check if sorted by year and month descending
      expect(result.value![0].year).toBe(2024);
      expect(result.value![0].month).toBe(2);
      expect(result.value![1].year).toBe(2024);
      expect(result.value![1].month).toBe(1);
      expect(result.value![2].year).toBe(2023);
      expect(result.value![2].month).toBe(12);
    });

    it('should return empty array when no budgets found', async () => {
      mockRepository.findByUserId = mock(() => Promise.resolve(Result.ok([])));

      const query = new ListBudgetsQuery('user-123');
      const result = await handler.execute(query);

      expect(result.isOk()).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('should log operation with correct context', async () => {
      const query = new ListBudgetsQuery('user-123');
      await handler.execute(query);

      expect(mockLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'ListBudgets',
          context: expect.objectContaining({
            userId: 'user-123',
          }),
        }),
      );
    });

    it('should handle repository errors', async () => {
      mockRepository.findByUserId = mock(() =>
        Promise.resolve(Result.fail(new Error('Database error'))),
      );

      const query = new ListBudgetsQuery('user-123');
      const result = await handler.execute(query);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Database error');
    });

    it('should log info with budget count', async () => {
      const budget1 = Budget.create(
        {
          userId: 'user-123',
          period: BudgetPeriod.create(1, 2024).value!,
          description: 'January Budget',
          templateId: 'template-123',
        },
        'budget-1',
      ).value!;

      mockRepository.findByUserId = mock(() =>
        Promise.resolve(Result.ok([budget1])),
      );

      const query = new ListBudgetsQuery('user-123');
      await handler.execute(query);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          budgetCount: 1,
        }),
        'Budgets listed successfully',
      );
    });

    it('should sort budgets correctly with same year', async () => {
      const budget1 = Budget.create(
        {
          userId: 'user-123',
          period: BudgetPeriod.create(3, 2024).value!,
          description: 'March Budget',
          templateId: 'template-123',
        },
        'budget-1',
      ).value!;

      const budget2 = Budget.create(
        {
          userId: 'user-123',
          period: BudgetPeriod.create(1, 2024).value!,
          description: 'January Budget',
          templateId: 'template-123',
        },
        'budget-2',
      ).value!;

      const budget3 = Budget.create(
        {
          userId: 'user-123',
          period: BudgetPeriod.create(2, 2024).value!,
          description: 'February Budget',
          templateId: 'template-123',
        },
        'budget-3',
      ).value!;

      mockRepository.findByUserId = mock(() =>
        Promise.resolve(Result.ok([budget1, budget2, budget3])),
      );

      const query = new ListBudgetsQuery('user-123');
      const result = await handler.execute(query);

      expect(result.isOk()).toBe(true);
      expect(result.value![0].month).toBe(3);
      expect(result.value![1].month).toBe(2);
      expect(result.value![2].month).toBe(1);
    });
  });
});
