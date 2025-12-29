import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { BudgetLineService } from './budget-line.service';
import { BudgetService } from '../budget/budget.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { PinoLogger } from 'nestjs-pino';
import type { BudgetLineCreate, BudgetLineUpdate } from '@pulpe/shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetLineRow } from './entities/budget-line.entity';

describe('BudgetLineService', () => {
  let service: BudgetLineService;
  let _logger: PinoLogger;
  type MockSupabaseResponse<T> = {
    data: T | null;
    error: Error | null;
  };

  type MockSupabaseQueryBuilder = {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    eq: jest.Mock;
    order: jest.Mock;
    single: jest.Mock;
  };

  // Helper function to create properly typed mock query builders
  const createMockQueryBuilder = (
    response: MockSupabaseResponse<unknown>,
  ): MockSupabaseQueryBuilder => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(response),
        order: jest.fn().mockResolvedValue(response),
      }),
      order: jest.fn().mockResolvedValue(response),
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(response),
      }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue(response),
        }),
      }),
    }),
    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue(response),
    }),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  });

  let mockSupabase: {
    from: jest.Mock;
  };
  let mockUser: AuthenticatedUser;

  // Helper function to cast mock to AuthenticatedSupabaseClient
  const getMockSupabaseClient = () =>
    mockSupabase as unknown as AuthenticatedSupabaseClient;

  const mockBudgetLineDb: BudgetLineRow = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    budget_id: '123e4567-e89b-12d3-a456-426614174001',
    template_line_id: '123e4567-e89b-12d3-a456-426614174002',
    savings_goal_id: null,
    name: 'Salaire',
    amount: 2500,
    kind: 'income' as const,
    recurrence: 'fixed' as const,
    is_manually_adjusted: false,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const mockBudgetLineApi = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    budgetId: '123e4567-e89b-12d3-a456-426614174001',
    templateLineId: '123e4567-e89b-12d3-a456-426614174002',
    savingsGoalId: null,
    name: 'Salaire',
    amount: 2500,
    kind: 'income' as const,
    recurrence: 'fixed' as const,
    isManuallyAdjusted: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    const mockLoggerInstance = {
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    };

    mockSupabase = {
      from: jest.fn(),
    };

    mockUser = {
      id: 'user123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetLineService,
        {
          provide: `PinoLogger:${BudgetLineService.name}`,
          useValue: mockLoggerInstance,
        },
        {
          provide: BudgetService,
          useValue: {
            recalculateBalances: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetLineService>(BudgetLineService);
    _logger = module.get<PinoLogger>(`PinoLogger:${BudgetLineService.name}`);
  });

  describe('findByBudgetId', () => {
    it('should return budget lines for a specific budget', async () => {
      const budgetId = '123e4567-e89b-12d3-a456-426614174001';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: [mockBudgetLineDb],
          error: null,
        }),
      );

      const result = await service.findByBudgetId(
        budgetId,
        getMockSupabaseClient(),
      );

      expect(result).toEqual({
        success: true,
        data: [mockBudgetLineApi],
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('budget_line');
      // Mapper functions are now pure functions, no need to check calls
    });

    it('should throw BusinessException on database error', async () => {
      const budgetId = '123e4567-e89b-12d3-a456-426614174001';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: new Error('Database error'),
        }),
      );

      await expect(
        service.findByBudgetId(budgetId, getMockSupabaseClient()),
      ).rejects.toThrow(BusinessException);
    });

    it('should return empty array when no budget lines found', async () => {
      const budgetId = '123e4567-e89b-12d3-a456-426614174001';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: [],
          error: null,
        }),
      );

      const result = await service.findByBudgetId(
        budgetId,
        getMockSupabaseClient(),
      );

      expect(result).toEqual({
        success: true,
        data: [],
      });
      // Mapper functions are now pure functions, no need to check calls
    });
  });

  describe('findOne', () => {
    it('should return a single budget line', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: mockBudgetLineDb,
          error: null,
        }),
      );

      const result = await service.findOne(
        budgetLineId,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(result).toEqual({
        success: true,
        data: mockBudgetLineApi,
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('budget_line');
      // Mapper functions are now pure functions, no need to check calls
    });

    it('should throw BusinessException when budget line not found', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: new Error('Not found'),
        }),
      );

      await expect(
        service.findOne(budgetLineId, mockUser, getMockSupabaseClient()),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('create', () => {
    const mockCreateDto: BudgetLineCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Salaire',
      amount: 2500,
      kind: 'income',
      recurrence: 'fixed',
      templateLineId: '123e4567-e89b-12d3-a456-426614174002',
      savingsGoalId: null,
      isManuallyAdjusted: false,
    };

    it('should create a new budget line', async () => {
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: mockBudgetLineDb,
          error: null,
        }),
      );

      const result = await service.create(
        mockCreateDto,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(result).toEqual({
        success: true,
        data: mockBudgetLineApi,
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('budget_line');
      // Mapper functions are now pure functions, no need to check calls
    });

    it('should throw BusinessException for invalid data', async () => {
      const invalidDto: BudgetLineCreate = {
        ...mockCreateDto,
        budgetId: '',
      };

      await expect(
        service.create(invalidDto, mockUser, getMockSupabaseClient()),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw BusinessException on database error', async () => {
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: new Error('Database error'),
        }),
      );

      await expect(
        service.create(mockCreateDto, mockUser, getMockSupabaseClient()),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('update', () => {
    const mockUpdateDto: BudgetLineUpdate = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Salaire Updated',
      amount: 2600,
    };

    it('should update a budget line', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const updatedBudgetLine = {
        ...mockBudgetLineDb,
        name: 'Salaire Updated',
        amount: 2600,
      };

      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: updatedBudgetLine,
          error: null,
        }),
      );

      const result = await service.update(
        budgetLineId,
        mockUpdateDto,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(result).toEqual({
        success: true,
        data: {
          id: updatedBudgetLine.id,
          budgetId: updatedBudgetLine.budget_id,
          templateLineId: updatedBudgetLine.template_line_id,
          savingsGoalId: updatedBudgetLine.savings_goal_id,
          name: updatedBudgetLine.name,
          amount: updatedBudgetLine.amount,
          kind: 'income', // Enums maintenant unifiés - pas de conversion
          recurrence: updatedBudgetLine.recurrence,
          isManuallyAdjusted: updatedBudgetLine.is_manually_adjusted,
          createdAt: updatedBudgetLine.created_at,
          updatedAt: updatedBudgetLine.updated_at,
        },
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('budget_line');
      // Mapper functions are now pure functions, no need to check calls
    });

    it('should throw BusinessException when budget line not found', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: new Error('Not found'),
        }),
      );

      await expect(
        service.update(
          budgetLineId,
          mockUpdateDto,
          mockUser,
          getMockSupabaseClient(),
        ),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw BusinessException for invalid update data', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUpdateDto: BudgetLineUpdate = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        amount: -100, // Invalid negative amount
      };

      await expect(
        service.update(
          budgetLineId,
          invalidUpdateDto,
          mockUser,
          getMockSupabaseClient(),
        ),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('remove', () => {
    it('should delete a budget line', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: null,
        }),
      );

      const result = await service.remove(
        budgetLineId,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(result).toEqual({
        success: true,
        message: 'Budget line deleted successfully',
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('budget_line');
    });

    it('should throw BusinessException when budget line not found', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: new Error('Not found'),
        }),
      );

      await expect(
        service.remove(budgetLineId, mockUser, getMockSupabaseClient()),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('resetFromTemplate', () => {
    const mockTemplateLineId = '123e4567-e89b-12d3-a456-426614174002';
    const mockTemplateLine = {
      name: 'Template Salaire',
      amount: 3000,
      kind: 'income' as const,
      recurrence: 'fixed' as const,
    };

    const mockBudgetLineWithTemplate: BudgetLineRow = {
      ...mockBudgetLineDb,
      template_line_id: mockTemplateLineId,
      is_manually_adjusted: true,
    };

    const mockBudgetLineWithoutTemplate: BudgetLineRow = {
      ...mockBudgetLineDb,
      template_line_id: null,
    };

    it('should reset budget line from template when template exists', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';

      // First call: fetch budget line
      // Second call: fetch template line
      // Third call: update budget line
      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'budget_line' && callCount === 1) {
          return createMockQueryBuilder({
            data: mockBudgetLineWithTemplate,
            error: null,
          });
        }
        if (table === 'template_line') {
          return createMockQueryBuilder({
            data: mockTemplateLine,
            error: null,
          });
        }
        // Update call
        return createMockQueryBuilder({
          data: {
            ...mockBudgetLineWithTemplate,
            name: mockTemplateLine.name,
            amount: mockTemplateLine.amount,
            is_manually_adjusted: false,
          },
          error: null,
        });
      });

      const result = await service.resetFromTemplate(
        budgetLineId,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        name: mockTemplateLine.name,
        amount: mockTemplateLine.amount,
        isManuallyAdjusted: false,
      });
    });

    it('should throw BusinessException when budget line has no template_line_id', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';

      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: mockBudgetLineWithoutTemplate,
          error: null,
        }),
      );

      try {
        await service.resetFromTemplate(
          budgetLineId,
          mockUser,
          getMockSupabaseClient(),
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_BUDGET_LINE_VALIDATION_FAILED',
        );
      }
    });

    it('should throw BusinessException when template line is deleted', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'budget_line' && callCount === 1) {
          return createMockQueryBuilder({
            data: mockBudgetLineWithTemplate,
            error: null,
          });
        }
        // Template line query returns not found
        if (table === 'template_line') {
          return createMockQueryBuilder({
            data: null,
            error: new Error('Not found'),
          });
        }
        return createMockQueryBuilder({ data: null, error: null });
      });

      try {
        await service.resetFromTemplate(
          budgetLineId,
          mockUser,
          getMockSupabaseClient(),
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_TEMPLATE_LINE_NOT_FOUND',
        );
      }
    });
  });
});
