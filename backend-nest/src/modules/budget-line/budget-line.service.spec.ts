import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { BudgetLineService } from './budget-line.service';
import { BudgetService } from '../budget/budget.service';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetLineCreate, BudgetLineUpdate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetLineRow } from './entities/budget-line.entity';

describe('BudgetLineService', () => {
  let service: BudgetLineService;
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
    rpc: jest.Mock;
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
    amount_encrypted: null,
    kind: 'income' as const,
    recurrence: 'fixed' as const,
    is_manually_adjusted: false,
    checked_at: null,
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
    checkedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    mockSupabase = {
      from: jest.fn(),
      rpc: jest.fn(),
    };

    mockUser = {
      id: 'user123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      accessToken: 'mock-token',
      clientKey: Buffer.from('ab'.repeat(32), 'hex'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetLineService,
        {
          provide: BudgetService,
          useValue: {
            recalculateBalances: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            getUserDEK: jest.fn().mockResolvedValue(Buffer.alloc(32)),
            ensureUserDEK: jest.fn().mockResolvedValue(Buffer.alloc(32)),
            encryptAmount: jest.fn().mockReturnValue('encrypted-mock'),
            prepareAmountData: jest
              .fn()
              .mockImplementation((amount: number) =>
                Promise.resolve({ amount, amount_encrypted: null }),
              ),
            decryptAmount: jest
              .fn()
              .mockImplementation((_ct: string, _dek: Buffer) => 100),
            tryDecryptAmount: jest
              .fn()
              .mockImplementation(
                (_ct: string, _dek: Buffer, fallback: number) => fallback,
              ),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetLineService>(BudgetLineService);
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
        mockUser,
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
        service.findByBudgetId(budgetId, mockUser, getMockSupabaseClient()),
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
        mockUser,
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
      const updatedBudgetLine: BudgetLineRow = {
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
          checkedAt: updatedBudgetLine.checked_at,
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

  describe('checkTransactions', () => {
    const mockTransactionRow = {
      id: 'tx-123',
      budget_id: '123e4567-e89b-12d3-a456-426614174001',
      budget_line_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Transaction',
      amount: 100,
      kind: 'expense' as const,
      transaction_date: '2024-01-15',
      category: null,
      checked_at: '2024-01-15T10:30:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z',
    };

    it('should check all unchecked transactions and return mapped results', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';

      mockSupabase.rpc.mockResolvedValue({
        data: [mockTransactionRow],
        error: null,
      });

      const result = await service.checkTransactions(
        budgetLineId,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'check_unchecked_transactions',
        { p_budget_line_id: budgetLineId },
      );
      expect(result).toEqual({
        success: true,
        data: [
          {
            id: 'tx-123',
            budgetId: '123e4567-e89b-12d3-a456-426614174001',
            budgetLineId: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test Transaction',
            amount: 100,
            kind: 'expense',
            transactionDate: '2024-01-15',
            category: null,
            checkedAt: '2024-01-15T10:30:00.000Z',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-15T10:30:00.000Z',
          },
        ],
      });
    });

    it('should throw BusinessException on rpc error', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error('RPC error'),
      });

      await expect(
        service.checkTransactions(
          budgetLineId,
          mockUser,
          getMockSupabaseClient(),
        ),
      ).rejects.toThrow(BusinessException);
    });

    it('should return empty array when no unchecked transactions', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';

      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.checkTransactions(
        budgetLineId,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(result).toEqual({
        success: true,
        data: [],
      });
    });
  });

  describe('toggleCheck', () => {
    it('should set checked_at when budget line is unchecked', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const checkedTimestamp = '2024-01-15T10:30:00.000Z';

      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { ...mockBudgetLineDb, checked_at: checkedTimestamp },
          error: null,
        }),
      });

      const result = await service.toggleCheck(
        budgetLineId,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'toggle_budget_line_check',
        { p_budget_line_id: budgetLineId },
      );
      expect(result.success).toBe(true);
      expect(result.data.checkedAt).not.toBeNull();
    });

    it('should clear checked_at when budget line is checked', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';

      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { ...mockBudgetLineDb, checked_at: null },
          error: null,
        }),
      });

      const result = await service.toggleCheck(
        budgetLineId,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'toggle_budget_line_check',
        { p_budget_line_id: budgetLineId },
      );
      expect(result.success).toBe(true);
      expect(result.data.checkedAt).toBeNull();
    });

    it('should throw BusinessException when budget line not found', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';

      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Not found'),
        }),
      });

      await expect(
        service.toggleCheck(budgetLineId, mockUser, getMockSupabaseClient()),
      ).rejects.toThrow(BusinessException);
    });
  });
});
