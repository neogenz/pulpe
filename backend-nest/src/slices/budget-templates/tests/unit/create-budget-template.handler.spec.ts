import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { CreateBudgetTemplateHandler } from '../../application/handlers/create-budget-template.handler';
import { CreateBudgetTemplateCommand } from '../../application/commands/create-budget-template.command';
import type { BudgetTemplateRepository } from '../../domain/repositories/budget-template.repository';
import { BudgetTemplate } from '../../domain/entities/budget-template.entity';
import { TemplateInfo } from '../../domain/value-objects/template-info.value-object';
import { TemplateLine } from '../../domain/value-objects/template-line.value-object';
import { BudgetTemplateCreatedEvent } from '../../domain/events/budget-template-created.event';

describe('CreateBudgetTemplateHandler', () => {
  let handler: CreateBudgetTemplateHandler;
  let mockRepository: BudgetTemplateRepository;
  let mockEventBus: EventBus;
  let mockLogger: PinoLogger;

  beforeEach(() => {
    // Create mocks
    mockRepository = {
      findById: mock(() => Promise.resolve(Result.ok(null))),
      findByUserId: mock(() => Promise.resolve(Result.ok([]))),
      findDefaultByUserId: mock(() => Promise.resolve(Result.ok(null))),
      save: mock(() => Promise.resolve(Result.ok({} as BudgetTemplate))),
      saveWithLines: mock(() =>
        Promise.resolve(Result.ok({} as BudgetTemplate)),
      ),
      delete: mock(() => Promise.resolve(Result.ok())),
      exists: mock(() => Promise.resolve(Result.ok(false))),
      countByUserId: mock(() => Promise.resolve(Result.ok(0))),
      setAsDefault: mock(() => Promise.resolve(Result.ok())),
      findLinesByTemplateId: mock(() => Promise.resolve(Result.ok([]))),
      saveLines: mock(() => Promise.resolve(Result.ok([]))),
      deleteLine: mock(() => Promise.resolve(Result.ok())),
      deleteAllLines: mock(() => Promise.resolve(Result.ok())),
    } as BudgetTemplateRepository;

    mockEventBus = {
      publish: mock(() => {}),
    } as any;

    mockLogger = {
      setContext: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
    } as any;

    handler = new CreateBudgetTemplateHandler(
      mockRepository,
      mockEventBus,
      mockLogger,
    );
  });

  describe('execute', () => {
    it('should create a budget template with provided lines', async () => {
      // Arrange
      const command = new CreateBudgetTemplateCommand(
        'user-123',
        'My Budget',
        'Monthly budget template',
        false,
        [
          {
            name: 'Salary',
            amount: 5000,
            kind: 'INCOME',
            recurrence: 'fixed',
            description: 'Monthly salary',
          },
          {
            name: 'Rent',
            amount: 1200,
            kind: 'FIXED_EXPENSE',
            recurrence: 'fixed',
            description: 'Monthly rent',
          },
        ],
      );

      const createdTemplate = BudgetTemplate.create(
        {
          userId: 'user-123',
          info: TemplateInfo.create({
            name: 'My Budget',
            description: 'Monthly budget template',
            isDefault: false,
          }).value,
          lines: [
            TemplateLine.create({
              name: 'Salary',
              amount: 5000,
              kind: 'INCOME',
              recurrence: 'fixed',
              description: 'Monthly salary',
            }).value,
            TemplateLine.create({
              name: 'Rent',
              amount: 1200,
              kind: 'FIXED_EXPENSE',
              recurrence: 'fixed',
              description: 'Monthly rent',
            }).value,
          ],
        },
        'template-123',
      ).value;

      spyOn(mockRepository, 'saveWithLines').mockResolvedValue(
        Result.ok(createdTemplate),
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(createdTemplate);
      expect(mockRepository.saveWithLines).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);

      const publishedEvent = (mockEventBus.publish as any).mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(BudgetTemplateCreatedEvent);
      expect(publishedEvent.templateId).toBe('template-123');
      expect(publishedEvent.userId).toBe('user-123');
    });

    it('should create a budget template with default income line when no lines provided', async () => {
      // Arrange
      const command = new CreateBudgetTemplateCommand(
        'user-123',
        'Empty Budget',
        null,
        false,
        undefined, // No lines provided
      );

      spyOn(mockRepository, 'saveWithLines').mockImplementation(
        async (template) => {
          // Verify template has default income line
          expect(template.lines).toHaveLength(1);
          expect(template.lines[0].name).toBe('Monthly Income');
          expect(template.lines[0].kind).toBe('INCOME');
          expect(template.lines[0].amount).toBe(0);
          return Result.ok(template);
        },
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockRepository.saveWithLines).toHaveBeenCalledTimes(1);
    });

    it('should set template as default and unset others', async () => {
      // Arrange
      const command = new CreateBudgetTemplateCommand(
        'user-123',
        'Default Budget',
        'My default template',
        true, // isDefault = true
        [
          {
            name: 'Income',
            amount: 5000,
            kind: 'INCOME',
            recurrence: 'fixed',
          },
        ],
      );

      const createdTemplate = BudgetTemplate.create(
        {
          userId: 'user-123',
          info: TemplateInfo.create({
            name: 'Default Budget',
            description: 'My default template',
            isDefault: true,
          }).value,
          lines: [
            TemplateLine.create({
              name: 'Income',
              amount: 5000,
              kind: 'INCOME',
              recurrence: 'fixed',
            }).value,
          ],
        },
        'template-123',
      ).value;

      spyOn(mockRepository, 'setAsDefault').mockResolvedValue(Result.ok());
      spyOn(mockRepository, 'saveWithLines').mockResolvedValue(
        Result.ok(createdTemplate),
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockRepository.setAsDefault).toHaveBeenCalledTimes(1);
      expect(mockRepository.setAsDefault).toHaveBeenCalledWith(
        expect.any(String),
        'user-123',
      );
    });

    it('should fail with invalid template info', async () => {
      // Arrange
      const command = new CreateBudgetTemplateCommand(
        'user-123',
        '', // Invalid empty name
        null,
        false,
        [],
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_TEMPLATE_INFO');
      expect(mockRepository.saveWithLines).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should fail with invalid line data', async () => {
      // Arrange
      const command = new CreateBudgetTemplateCommand(
        'user-123',
        'My Budget',
        null,
        false,
        [
          {
            name: '', // Invalid empty name
            amount: 100,
            kind: 'INCOME',
            recurrence: 'fixed',
          },
        ],
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_NAME');
      expect(mockRepository.saveWithLines).not.toHaveBeenCalled();
    });

    it('should handle repository save failure', async () => {
      // Arrange
      const command = new CreateBudgetTemplateCommand(
        'user-123',
        'My Budget',
        null,
        false,
        [
          {
            name: 'Income',
            amount: 5000,
            kind: 'INCOME',
            recurrence: 'fixed',
          },
        ],
      );

      const saveError = new GenericDomainException(
        'Database error',
        'DB_ERROR',
        'Connection failed',
      );
      spyOn(mockRepository, 'saveWithLines').mockResolvedValue(
        Result.fail(saveError),
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('DB_ERROR');
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      // Arrange
      const command = new CreateBudgetTemplateCommand(
        'user-123',
        'My Budget',
        null,
        false,
        [
          {
            name: 'Income',
            amount: 5000,
            kind: 'INCOME',
            recurrence: 'fixed',
          },
        ],
      );

      spyOn(mockRepository, 'saveWithLines').mockRejectedValue(
        new Error('Unexpected error'),
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('CREATE_TEMPLATE_ERROR');
      expect(result.error.details).toBe('Unexpected error');
    });

    it('should log appropriate messages during execution', async () => {
      // Arrange
      const command = new CreateBudgetTemplateCommand(
        'user-123',
        'My Budget',
        null,
        false,
        [
          {
            name: 'Income',
            amount: 5000,
            kind: 'INCOME',
            recurrence: 'fixed',
          },
        ],
      );

      const createdTemplate = BudgetTemplate.create(
        {
          userId: 'user-123',
          info: TemplateInfo.create({
            name: 'My Budget',
            description: null,
            isDefault: false,
          }).value,
          lines: [
            TemplateLine.create({
              name: 'Income',
              amount: 5000,
              kind: 'INCOME',
              recurrence: 'fixed',
            }).value,
          ],
        },
        'template-123',
      ).value;

      spyOn(mockRepository, 'saveWithLines').mockResolvedValue(
        Result.ok(createdTemplate),
      );

      // Act
      await handler.execute(command);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledTimes(2);

      // Check start log
      const startLog = (mockLogger.info as any).mock.calls[0][0];
      expect(startLog.operation).toBe('create-budget-template.start');
      expect(startLog.userId).toBe('user-123');
      expect(startLog.name).toBe('My Budget');

      // Check success log
      const successLog = (mockLogger.info as any).mock.calls[1][0];
      expect(successLog.operation).toBe('create-budget-template.success');
      expect(successLog.templateId).toBe('template-123');
      expect(successLog.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
