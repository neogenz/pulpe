import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { CreateBudgetHandler } from '../../application/handlers/create-budget.handler';
import { CreateBudgetCommand } from '../../application/commands/create-budget.command';
import type { BudgetRepository } from '../../domain/repositories';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { Result } from '@shared/domain/enhanced-result';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import { DomainException } from '@shared/domain/exceptions/domain.exception';

describe('CreateBudgetHandler', () => {
  let handler: CreateBudgetHandler;
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

    handler = new CreateBudgetHandler(mockRepository, mockLogger);
  });

  describe('execute', () => {
    const validCommand = new CreateBudgetCommand(
      'user-123',
      1,
      2024,
      'January 2024 Budget',
      'template-123',
    );

    it('should create budget successfully', async () => {
      const result = await handler.execute(validCommand);

      expect(result.isOk()).toBe(true);
      expect(result.value).toHaveProperty('id');
      expect(result.value).toHaveProperty('month', 1);
      expect(result.value).toHaveProperty('year', 2024);
      expect(result.value).toHaveProperty('description', 'January 2024 Budget');
      expect(result.value).toHaveProperty('templateId', 'template-123');
      expect(result.value).toHaveProperty('budgetLinesCreated', 5);
    });

    it('should log operation with correct context', async () => {
      await handler.execute(validCommand);

      expect(mockLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'CreateBudget',
          context: expect.objectContaining({
            userId: 'user-123',
            month: 1,
            year: 2024,
            templateId: 'template-123',
          }),
        }),
      );
    });

    it('should call createFromTemplate on repository', async () => {
      await handler.execute(validCommand);

      expect(mockRepository.createFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          userId: 'user-123',
          templateId: 'template-123',
        }),
        'template-123',
      );
    });

    it('should fail if budget already exists for period', async () => {
      mockRepository.existsForPeriod = mock(() =>
        Promise.resolve(Result.ok(true)),
      );

      const result = await handler.execute(validCommand);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain(
        'Budget already exists for this period',
      );
    });

    it('should fail with invalid month', async () => {
      const invalidCommand = new CreateBudgetCommand(
        'user-123',
        13, // Invalid month
        2024,
        'Invalid Budget',
        'template-123',
      );

      const result = await handler.execute(invalidCommand);

      expect(result.isFail()).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Invalid month');
    });

    it('should fail with invalid year', async () => {
      const invalidCommand = new CreateBudgetCommand(
        'user-123',
        1,
        2019, // Too old
        'Invalid Budget',
        'template-123',
      );

      const result = await handler.execute(invalidCommand);

      expect(result.isFail()).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Invalid year');
    });

    it('should fail with empty description', async () => {
      const invalidCommand = new CreateBudgetCommand(
        'user-123',
        1,
        2024,
        '', // Empty description
        'template-123',
      );

      const result = await handler.execute(invalidCommand);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Description is required');
    });

    it('should fail if repository createFromTemplate fails', async () => {
      mockRepository.createFromTemplate = mock(() =>
        Promise.resolve(Result.fail('Template not found')),
      );

      const result = await handler.execute(validCommand);

      expect(result.isFail()).toBe(true);
      expect(result.error?.message).toContain('Template not found');
    });

    it('should log error when operation fails', async () => {
      // Make the repository throw an actual error
      mockRepository.existsForPeriod = mock(() =>
        Promise.reject(new Error('Database connection failed')),
      );

      await handler.execute(validCommand);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          context: expect.objectContaining({
            userId: 'user-123',
            month: 1,
            year: 2024,
          }),
        }),
        'Failed to create budget',
      );
    });
  });
});
