import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { BudgetLineService } from './budget-line.service';
import { BudgetService } from '../budget/budget.service';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetLineCreate, BudgetLineUpdate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetLineRow } from './entities/budget-line.entity';

describe('BudgetLineService', () => {
  let service: BudgetLineService;
  let currencyServiceMock!: {
    getRate: ReturnType<typeof jest.fn>;
    overrideExchangeRate: ReturnType<typeof jest.fn>;
  };
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
    amount: 'encrypted-2500',
    kind: 'income' as const,
    recurrence: 'fixed' as const,
    is_manually_adjusted: false,
    checked_at: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    original_amount: null,
    original_currency: null,
    target_currency: null,
    exchange_rate: null,
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

    currencyServiceMock = {
      getRate: jest.fn().mockResolvedValue({
        base: 'EUR',
        target: 'CHF',
        rate: 0.93,
        date: '2026-03-10',
      }),
      // Mirrors production overrideExchangeRate — keep in sync with currency.service.ts
      overrideExchangeRate: jest
        .fn()
        .mockImplementation(async (dto: BudgetLineUpdate) => {
          const sameCurrency =
            !!dto.originalCurrency &&
            !!dto.targetCurrency &&
            dto.originalCurrency === dto.targetCurrency;
          const missingCurrencyPair =
            !dto.originalCurrency || !dto.targetCurrency;

          if (sameCurrency || missingCurrencyPair) {
            const sanitized: Record<string, unknown> = { ...dto };
            delete sanitized.exchangeRate;
            delete sanitized.originalAmount;
            if (sameCurrency) {
              delete sanitized.originalCurrency;
              delete sanitized.targetCurrency;
            }
            return sanitized;
          }
          const { rate } = (await currencyServiceMock.getRate(
            dto.originalCurrency,
            dto.targetCurrency,
          )) as { rate: number };
          return { ...dto, exchangeRate: rate };
        }),
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
              .mockImplementation((_amount: number) =>
                Promise.resolve({ amount: 'encrypted-mock' }),
              ),
            decryptAmount: jest
              .fn()
              .mockImplementation((_ct: string, _dek: Buffer) => 100),
            tryDecryptAmount: jest.fn().mockReturnValue(2500),
            decryptRowAmountFields: jest.fn().mockImplementation(
              (
                row: {
                  amount: string | null;
                  original_amount: string | null;
                },
                _dek: Buffer,
              ) => ({
                ...row,
                amount: row.amount ? 2500 : 0,
                original_amount: row.original_amount ? 2500 : null,
              }),
            ),
            encryptOptionalAmount: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: CurrencyService,
          useValue: currencyServiceMock,
        },
        {
          provide: CacheService,
          useValue: {
            getOrSet: jest
              .fn()
              .mockImplementation(
                (
                  _userId: string,
                  _key: string,
                  _ttl: number,
                  fetcher: () => Promise<unknown>,
                ) => fetcher(),
              ),
            invalidateForUser: jest.fn().mockResolvedValue(undefined),
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

    it('should persist checkedAt when provided', async () => {
      const checkedDto: BudgetLineCreate = {
        ...mockCreateDto,
        checkedAt: '2026-03-10T10:00:00.000Z',
      };
      const checkedBudgetLineDb: BudgetLineRow = {
        ...mockBudgetLineDb,
        checked_at: '2026-03-10T10:00:00.000Z',
      };

      const queryBuilder = createMockQueryBuilder({
        data: checkedBudgetLineDb,
        error: null,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await service.create(
        checkedDto,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(result.success).toBe(true);
      const insertCall = queryBuilder.insert.mock.calls[0][0];
      expect(insertCall.checked_at).toBe('2026-03-10T10:00:00.000Z');
    });

    it('should default checkedAt to null when not provided', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: mockBudgetLineDb,
        error: null,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await service.create(mockCreateDto, mockUser, getMockSupabaseClient());

      const insertCall = queryBuilder.insert.mock.calls[0][0];
      expect(insertCall.checked_at).toBeNull();
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
        amount: 'encrypted-string',
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
          amount: 2500,
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

    it('should omit currency columns when update only touches name (mono-currency PATCH)', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const queryBuilder = createMockQueryBuilder({
        data: { ...mockBudgetLineDb, name: 'Spotify' },
        error: null,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await service.update(
        budgetLineId,
        {
          id: budgetLineId,
          name: 'Spotify',
        },
        mockUser,
        getMockSupabaseClient(),
      );

      const updatePayload = queryBuilder.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updatePayload).toHaveProperty('name', 'Spotify');
      expect(updatePayload).not.toHaveProperty('original_currency');
      expect(updatePayload).not.toHaveProperty('target_currency');
      expect(updatePayload).not.toHaveProperty('exchange_rate');
    });

    it('should strip orphan exchangeRate when no currency pair is provided (PUL-99 RG-009)', async () => {
      // RG-009: "Le taux est figé définitivement au moment de la saisie —
      // jamais recalculé rétroactivement". A PATCH sending only exchangeRate
      // without currency context is treated as forged and stripped before
      // reaching the mapper.
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const queryBuilder = createMockQueryBuilder({
        data: { ...mockBudgetLineDb, exchange_rate: 1.08 },
        error: null,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await service.update(
        budgetLineId,
        {
          id: budgetLineId,
          exchangeRate: 1.08,
        },
        mockUser,
        getMockSupabaseClient(),
      );

      const updatePayload = queryBuilder.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updatePayload).not.toHaveProperty('exchange_rate');
      expect(updatePayload).not.toHaveProperty('original_currency');
      expect(updatePayload).not.toHaveProperty('target_currency');
    });

    it('should map full currency metadata and call overrideExchangeRate when both currencies are set', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const queryBuilder = createMockQueryBuilder({
        data: {
          ...mockBudgetLineDb,
          original_currency: 'EUR',
          target_currency: 'CHF',
          exchange_rate: 0.93,
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await service.update(
        budgetLineId,
        {
          id: budgetLineId,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 1.05,
        },
        mockUser,
        getMockSupabaseClient(),
      );

      expect(currencyServiceMock.overrideExchangeRate).toHaveBeenCalled();
      const updatePayload = queryBuilder.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updatePayload).toMatchObject({
        original_currency: 'EUR',
        target_currency: 'CHF',
        exchange_rate: 0.93,
      });
    });

    it('should persist explicit null originalCurrency via mapper', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const queryBuilder = createMockQueryBuilder({
        data: { ...mockBudgetLineDb, original_currency: null },
        error: null,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await service.update(
        budgetLineId,
        {
          id: budgetLineId,
          originalCurrency: null,
        } as unknown as BudgetLineUpdate,
        mockUser,
        getMockSupabaseClient(),
      );

      const updatePayload = queryBuilder.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updatePayload).toMatchObject({ original_currency: null });
    });

    it('should clear stale FX metadata when PATCH sets same currency (PUL-115)', async () => {
      // Guards the direct PATCH path (distinct from resetFromTemplate CA4):
      // a previously EUR->CHF-converted line being edited with same-currency
      // input must have all 4 FX columns explicitly nulled in the DB write.
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const queryBuilder = createMockQueryBuilder({
        data: {
          ...mockBudgetLineDb,
          original_amount: null,
          original_currency: null,
          target_currency: 'CHF',
          exchange_rate: null,
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      // Override the in-file overrideExchangeRate mock (which predates PUL-115
      // and omits keys instead of emitting nulls) with the real production
      // contract for same-currency inputs: the 3 source FX fields are force-
      // nulled while targetCurrency is preserved from the client input.
      currencyServiceMock.overrideExchangeRate.mockImplementationOnce(
        async (dto: BudgetLineUpdate) => ({
          ...dto,
          originalAmount: null,
          originalCurrency: null,
          targetCurrency: 'CHF',
          exchangeRate: null,
        }),
      );

      await service.update(
        budgetLineId,
        {
          id: budgetLineId,
          name: 'Rent',
          amount: 1200,
          originalCurrency: 'CHF',
          targetCurrency: 'CHF',
          originalAmount: 50,
          exchangeRate: 1.08,
        } as unknown as BudgetLineUpdate,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(currencyServiceMock.overrideExchangeRate).toHaveBeenCalledTimes(1);
      const updatePayload = queryBuilder.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updatePayload.original_amount).toBeNull();
      expect(updatePayload.original_currency).toBeNull();
      expect(updatePayload.target_currency).toBe('CHF');
      expect(updatePayload.exchange_rate).toBeNull();
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
      original_amount: null,
      original_currency: null,
      target_currency: null,
      exchange_rate: null,
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
            amount: 'encrypted-string',
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
        amount: 2500,
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

    it('should propagate currency metadata from a multi-currency template line (PUL-99 CA4)', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';
      const multiCurrencyTemplateLine = {
        ...mockTemplateLine,
        original_amount: 'encrypted-original-100-eur',
        original_currency: 'EUR',
        target_currency: 'CHF',
        exchange_rate: 0.95,
      };

      const previouslyConvertedBudgetLine: BudgetLineRow = {
        ...mockBudgetLineWithTemplate,
        original_amount: 'stale-encrypted-foo',
        original_currency: 'USD',
        target_currency: 'CHF',
        exchange_rate: 0.8,
      };

      const updateSpy = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                ...previouslyConvertedBudgetLine,
                amount: 'encrypted-string',
                is_manually_adjusted: false,
              },
              error: null,
            }),
          }),
        }),
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'budget_line' && callCount === 1) {
          return createMockQueryBuilder({
            data: previouslyConvertedBudgetLine,
            error: null,
          });
        }
        if (table === 'template_line') {
          return createMockQueryBuilder({
            data: multiCurrencyTemplateLine,
            error: null,
          });
        }
        return {
          ...createMockQueryBuilder({ data: null, error: null }),
          update: updateSpy,
        };
      });

      await service.resetFromTemplate(
        budgetLineId,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(updateSpy).toHaveBeenCalledTimes(1);
      const writtenPayload = updateSpy.mock.calls[0][0];
      expect(writtenPayload.original_amount).toBe('encrypted-original-100-eur');
      expect(writtenPayload.original_currency).toBe('EUR');
      expect(writtenPayload.target_currency).toBe('CHF');
      expect(writtenPayload.exchange_rate).toBe(0.95);
    });

    it('should scrub stale currency metadata when template line is mono-currency (PUL-99 CA4)', async () => {
      const budgetLineId = '123e4567-e89b-12d3-a456-426614174000';

      const previouslyConvertedBudgetLine: BudgetLineRow = {
        ...mockBudgetLineWithTemplate,
        original_amount: 'stale-encrypted-foo',
        original_currency: 'EUR',
        target_currency: 'CHF',
        exchange_rate: 0.95,
      };

      const updateSpy = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                ...previouslyConvertedBudgetLine,
                amount: 'encrypted-string',
                is_manually_adjusted: false,
              },
              error: null,
            }),
          }),
        }),
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'budget_line' && callCount === 1) {
          return createMockQueryBuilder({
            data: previouslyConvertedBudgetLine,
            error: null,
          });
        }
        if (table === 'template_line') {
          return createMockQueryBuilder({
            data: mockTemplateLine,
            error: null,
          });
        }
        return {
          ...createMockQueryBuilder({ data: null, error: null }),
          update: updateSpy,
        };
      });

      await service.resetFromTemplate(
        budgetLineId,
        mockUser,
        getMockSupabaseClient(),
      );

      expect(updateSpy).toHaveBeenCalledTimes(1);
      const writtenPayload = updateSpy.mock.calls[0][0];
      expect(writtenPayload.original_amount).toBeNull();
      expect(writtenPayload.original_currency).toBeNull();
      expect(writtenPayload.target_currency).toBeNull();
      expect(writtenPayload.exchange_rate).toBeNull();
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
      amount: 'encrypted-2500',
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
            amount: 2500,
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
