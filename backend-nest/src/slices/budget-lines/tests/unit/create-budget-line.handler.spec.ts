import { Test } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { CreateBudgetLineHandler } from '../../application/handlers/create-budget-line.handler';
import { CreateBudgetLineCommand } from '../../application/commands/create-budget-line.command';
import {
  BUDGET_LINE_REPOSITORY_TOKEN,
  type BudgetLineRepository,
} from '../../domain/repositories/budget-line.repository';
import { BudgetLine } from '../../domain/entities/budget-line.entity';
import { BudgetLineAmount } from '../../domain/value-objects/budget-line-amount.value-object';
import { BudgetLineCategory } from '../../domain/value-objects/budget-line-category.value-object';
import { BudgetLineCreatedEvent } from '../../domain/events/budget-line-created.event';

describe('CreateBudgetLineHandler', () => {
  let handler: CreateBudgetLineHandler;
  let budgetLineRepository: BudgetLineRepository;
  let eventBus: EventBus;
  let logger: PinoLogger;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockBudgetId = '456e7890-e89b-12d3-a456-426614174000';
  const mockBudgetLineId = '789e0123-e89b-12d3-a456-426614174000';

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateBudgetLineHandler,
        {
          provide: BUDGET_LINE_REPOSITORY_TOKEN,
          useValue: {
            save: mock(() => {}),
          },
        },
        {
          provide: EventBus,
          useValue: {
            publish: mock(() => {}),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: mock(() => {}),
            info: mock(() => {}),
            warn: mock(() => {}),
            error: mock(() => {}),
          },
        },
      ],
    }).compile();

    handler = module.get<CreateBudgetLineHandler>(CreateBudgetLineHandler);
    budgetLineRepository = module.get<BudgetLineRepository>(
      BUDGET_LINE_REPOSITORY_TOKEN,
    );
    eventBus = module.get<EventBus>(EventBus);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  it('should successfully create a budget line', async () => {
    // Arrange
    const command = new CreateBudgetLineCommand(
      mockUserId,
      mockBudgetId,
      'Rent',
      1500,
      'fixed',
      'monthly',
      undefined,
      undefined,
      false,
    );

    const amount = BudgetLineAmount.create(1500).value;
    const category = BudgetLineCategory.create({
      name: 'Rent',
      kind: 'fixed',
      recurrence: 'monthly',
      isManuallyAdjusted: false,
    }).value;

    const budgetLine = BudgetLine.create(
      {
        budgetId: mockBudgetId,
        category,
        amount,
      },
      mockBudgetLineId,
    ).value;

    (budgetLineRepository.save as Mock).mockResolvedValue(
      Result.ok(budgetLine),
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(budgetLine);

    expect(budgetLineRepository.save).toHaveBeenCalledWith(
      expect.any(BudgetLine),
      mockUserId,
    );

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(BudgetLineCreatedEvent),
    );

    const publishedEvent = (eventBus.publish as Mock).mock.calls[0][0];
    expect(publishedEvent.budgetLineId).toBe(mockBudgetLineId);
    expect(publishedEvent.budgetId).toBe(mockBudgetId);
    expect(publishedEvent.name).toBe('Rent');
    expect(publishedEvent.amount).toBe(1500);
    expect(publishedEvent.kind).toBe('fixed');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'create-budget-line.start',
        userId: mockUserId,
        budgetId: mockBudgetId,
        name: 'Rent',
      }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'create-budget-line.success',
        userId: mockUserId,
        budgetLineId: mockBudgetLineId,
        budgetId: mockBudgetId,
      }),
    );
  });

  it('should handle invalid amount', async () => {
    // Arrange
    const command = new CreateBudgetLineCommand(
      mockUserId,
      mockBudgetId,
      'Rent',
      -100, // Invalid negative amount
      'fixed',
      'monthly',
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('INVALID_AMOUNT');

    expect(budgetLineRepository.save).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'create-budget-line.invalid-amount',
        userId: mockUserId,
        amount: -100,
      }),
    );
  });

  it('should handle invalid category name', async () => {
    // Arrange
    const command = new CreateBudgetLineCommand(
      mockUserId,
      mockBudgetId,
      '', // Empty name
      1500,
      'fixed',
      'monthly',
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('INVALID_NAME');

    expect(budgetLineRepository.save).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'create-budget-line.invalid-category',
        userId: mockUserId,
        name: '',
      }),
    );
  });

  it('should handle template line and savings goal conflict', async () => {
    // Arrange
    const command = new CreateBudgetLineCommand(
      mockUserId,
      mockBudgetId,
      'Investment',
      500,
      'goal',
      'monthly',
      'template-123',
      'goal-456', // Both template and goal set
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('INVALID_BUDGET_LINE');

    expect(budgetLineRepository.save).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'create-budget-line.invalid-entity',
        userId: mockUserId,
      }),
    );
  });

  it('should handle repository save failure', async () => {
    // Arrange
    const command = new CreateBudgetLineCommand(
      mockUserId,
      mockBudgetId,
      'Rent',
      1500,
      'fixed',
      'monthly',
    );

    const error = new GenericDomainException(
      'Database error',
      'REPOSITORY_ERROR',
      'Connection failed',
    );
    (budgetLineRepository.save as Mock).mockResolvedValue(Result.fail(error));

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isFailure).toBe(true);
    expect(result.error?.message).toBe(error.message);

    expect(eventBus.publish).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'create-budget-line.save-failed',
        userId: mockUserId,
        error: error.message,
      }),
    );
  });

  it('should handle unexpected errors', async () => {
    // Arrange
    const command = new CreateBudgetLineCommand(
      mockUserId,
      mockBudgetId,
      'Rent',
      1500,
      'fixed',
      'monthly',
    );

    const unexpectedError = new Error('Unexpected error');
    (budgetLineRepository.save as Mock).mockRejectedValue(unexpectedError);

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('CREATE_BUDGET_LINE_ERROR');
    expect(result.error.details).toBe(unexpectedError.message);

    expect(eventBus.publish).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'create-budget-line.error',
        userId: mockUserId,
        error: unexpectedError.message,
      }),
    );
  });

  it('should create budget line with template line ID', async () => {
    // Arrange
    const templateLineId = 'template-123';
    const command = new CreateBudgetLineCommand(
      mockUserId,
      mockBudgetId,
      'Insurance',
      300,
      'fixed',
      'monthly',
      templateLineId,
    );

    const amount = BudgetLineAmount.create(300).value;
    const category = BudgetLineCategory.create({
      name: 'Insurance',
      kind: 'fixed',
      recurrence: 'monthly',
      isManuallyAdjusted: false,
    }).value;

    const budgetLine = BudgetLine.create(
      {
        budgetId: mockBudgetId,
        templateLineId,
        category,
        amount,
      },
      mockBudgetLineId,
    ).value;

    (budgetLineRepository.save as Mock).mockResolvedValue(
      Result.ok(budgetLine),
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isSuccess).toBe(true);
    const savedBudgetLine = result.value;
    expect(savedBudgetLine.templateLineId).toBe(templateLineId);
    expect(savedBudgetLine.isFromTemplate()).toBe(true);
  });

  it('should mark as manually adjusted when specified', async () => {
    // Arrange
    const command = new CreateBudgetLineCommand(
      mockUserId,
      mockBudgetId,
      'Custom Expense',
      200,
      'envelope',
      'monthly',
      undefined,
      undefined,
      true, // Manually adjusted
    );

    const amount = BudgetLineAmount.create(200).value;
    const category = BudgetLineCategory.create({
      name: 'Custom Expense',
      kind: 'envelope',
      recurrence: 'monthly',
      isManuallyAdjusted: true,
    }).value;

    const budgetLine = BudgetLine.create(
      {
        budgetId: mockBudgetId,
        category,
        amount,
      },
      mockBudgetLineId,
    ).value;

    (budgetLineRepository.save as Mock).mockResolvedValue(
      Result.ok(budgetLine),
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isSuccess).toBe(true);
    const savedBudgetLine = result.value;
    expect(savedBudgetLine.category.isManuallyAdjusted).toBe(true);
  });
});
