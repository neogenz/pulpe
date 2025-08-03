import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { GetBudgetByPeriodHandler } from '../../application/handlers/get-budget-by-period.handler';
import { GetBudgetByPeriodQuery } from '../../application/queries/get-budget-by-period.query';
import type { BudgetRepository } from '../../domain/repositories';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { Result } from '@shared/domain/enhanced-result';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import { DomainException } from '@shared/domain/exceptions/domain.exception';

describe('GetBudgetByPeriodHandler', () => {
  let handler: GetBudgetByPeriodHandler;
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

    handler = new GetBudgetByPeriodHandler(mockRepository, mockLogger);
  });

  describe('execute', () => {
    it('should get budget by period successfully', async () => {
      const period = BudgetPeriod.create(1, 2024).value!;
      const budget = Budget.create(
        {
          userId: 'user-123',
          period,
          description: 'January Budget',
          templateId: 'template-123',
        },
        'budget-123',
      ).value!;

      mockRepository.findByPeriod = mock(() =>
        Promise.resolve(Result.ok(budget)),
      );

      const query = new GetBudgetByPeriodQuery(1, 2024, 'user-123');
      const result = await handler.execute(query);

      expect(result.isOk()).toBe(true);
      expect(result.value).toEqual({
        id: 'budget-123',
        userId: 'user-123',
        month: 1,
        year: 2024,
        description: 'January Budget',
        templateId: 'template-123',
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
      });
    });

    it('should return null when budget not found', async () => {
      mockRepository.findByPeriod = mock(() =>
        Promise.resolve(Result.ok(null)),
      );

      const query = new GetBudgetByPeriodQuery(1, 2024, 'user-123');
      const result = await handler.execute(query);

      expect(result.isOk()).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should fail with invalid month', async () => {
      const query = new GetBudgetByPeriodQuery(13, 2024, 'user-123');
      const result = await handler.execute(query);

      expect(result.isFail()).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Invalid month');
    });

    it('should fail with invalid year', async () => {
      const query = new GetBudgetByPeriodQuery(1, 2019, 'user-123');
      const result = await handler.execute(query);

      expect(result.isFail()).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Invalid year');
    });

    it('should log operation with correct context', async () => {
      const query = new GetBudgetByPeriodQuery(1, 2024, 'user-123');
      await handler.execute(query);

      expect(mockLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'GetBudgetByPeriod',
          context: expect.objectContaining({
            month: 1,
            year: 2024,
            userId: 'user-123',
          }),
        }),
      );
    });

    it('should handle repository errors', async () => {
      const period = BudgetPeriod.create(1, 2024).value!;
      mockRepository.findByPeriod = mock(() =>
        Promise.resolve(Result.fail(new Error('Database error'))),
      );

      const query = new GetBudgetByPeriodQuery(1, 2024, 'user-123');
      const result = await handler.execute(query);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Database error');
    });

    it('should log debug when budget found', async () => {
      const period = BudgetPeriod.create(1, 2024).value!;
      const budget = Budget.create(
        {
          userId: 'user-123',
          period,
          description: 'January Budget',
          templateId: 'template-123',
        },
        'budget-123',
      ).value!;

      mockRepository.findByPeriod = mock(() =>
        Promise.resolve(Result.ok(budget)),
      );

      const query = new GetBudgetByPeriodQuery(1, 2024, 'user-123');
      await handler.execute(query);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetId: 'budget-123',
          userId: 'user-123',
          period: '2024-01',
        }),
        'Budget found for period',
      );
    });

    it('should log debug when budget not found', async () => {
      mockRepository.findByPeriod = mock(() =>
        Promise.resolve(Result.ok(null)),
      );

      const query = new GetBudgetByPeriodQuery(1, 2024, 'user-123');
      await handler.execute(query);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          period: '2024-01',
        }),
        'No budget found for period',
      );
    });
  });
});
