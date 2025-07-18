import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BudgetLineService } from './budget-line.service';
import { BudgetLineMapper } from './budget-line.mapper';
import { PinoLogger } from 'nestjs-pino';
import type { BudgetLineCreate, BudgetLineUpdate } from '@pulpe/shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetLineRow } from './entities/budget-line.entity';

describe('BudgetLineService', () => {
  let service: BudgetLineService;
  let mapper: BudgetLineMapper;
  let logger: PinoLogger;
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
    kind: 'INCOME' as const,
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
    kind: 'INCOME' as const,
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
          provide: BudgetLineMapper,
          useValue: {
            toApi: jest.fn().mockReturnValue(mockBudgetLineApi),
            toApiList: jest
              .fn()
              .mockImplementation((data) => data.map(() => mockBudgetLineApi)),
          },
        },
        {
          provide: `PinoLogger:${BudgetLineService.name}`,
          useValue: mockLoggerInstance,
        },
      ],
    }).compile();

    service = module.get<BudgetLineService>(BudgetLineService);
    mapper = module.get<BudgetLineMapper>(BudgetLineMapper);
    logger = module.get<PinoLogger>(`PinoLogger:${BudgetLineService.name}`);
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
      expect(mapper.toApiList).toHaveBeenCalledWith([mockBudgetLineDb]);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      const budgetId = '123e4567-e89b-12d3-a456-426614174001';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: new Error('Database error'),
        }),
      );

      await expect(
        service.findByBudgetId(budgetId, getMockSupabaseClient()),
      ).rejects.toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalled();
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
      expect(mapper.toApiList).toHaveBeenCalledWith([]);
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
      expect(mapper.toApi).toHaveBeenCalledWith(mockBudgetLineDb);
    });

    it('should throw NotFoundException when budget line not found', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: new Error('Not found'),
        }),
      );

      await expect(
        service.findOne(budgetLineId, mockUser, getMockSupabaseClient()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const mockCreateDto: BudgetLineCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Salaire',
      amount: 2500,
      kind: 'INCOME',
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
      expect(mapper.toApi).toHaveBeenCalledWith(mockBudgetLineDb);
    });

    it('should throw BadRequestException for invalid data', async () => {
      const invalidDto: BudgetLineCreate = {
        ...mockCreateDto,
        budgetId: '',
      };

      await expect(
        service.create(invalidDto, mockUser, getMockSupabaseClient()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on database error', async () => {
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: new Error('Database error'),
        }),
      );

      await expect(
        service.create(mockCreateDto, mockUser, getMockSupabaseClient()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const mockUpdateDto: BudgetLineUpdate = {
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
        data: mockBudgetLineApi,
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('budget_line');
      expect(mapper.toApi).toHaveBeenCalledWith(updatedBudgetLine);
    });

    it('should throw NotFoundException when budget line not found', async () => {
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
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid update data', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUpdateDto: BudgetLineUpdate = {
        amount: -100, // Invalid negative amount
      };

      await expect(
        service.update(
          budgetLineId,
          invalidUpdateDto,
          mockUser,
          getMockSupabaseClient(),
        ),
      ).rejects.toThrow(BadRequestException);
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
        message: 'Ligne budgétaire supprimée avec succès',
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('budget_line');
    });

    it('should throw NotFoundException when budget line not found', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabase.from.mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: new Error('Not found'),
        }),
      );

      await expect(
        service.remove(budgetLineId, mockUser, getMockSupabaseClient()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
