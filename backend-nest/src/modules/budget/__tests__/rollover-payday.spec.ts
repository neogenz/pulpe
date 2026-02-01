import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BudgetService } from '../budget.service';
import { BudgetCalculator } from '../budget.calculator';
import { BudgetValidator } from '../budget.validator';
import { BudgetRepository } from '../budget.repository';
import {
  createMockSupabaseClient,
  createMockAuthenticatedUser,
  createMockBudgetEntity,
  createMockPinoLogger,
  MockSupabaseClient,
} from '../../../test/test-mocks';
import { INFO_LOGGER_TOKEN } from '@common/logger';
import { EncryptionService } from '@modules/encryption/encryption.service';

describe('Rollover with payDayOfMonth', () => {
  let service: BudgetService;
  let mockSupabaseClient: MockSupabaseClient;
  let mockCalculator: Partial<BudgetCalculator>;

  const mockUser = createMockAuthenticatedUser();
  const mockPinoLogger = createMockPinoLogger();

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    mockCalculator = {
      calculateEndingBalance: () => Promise.resolve(100),
      recalculateAndPersist: () => Promise.resolve(),
      getRollover: () =>
        Promise.resolve({ rollover: 50, previousBudgetId: null }),
    };

    const module = await Test.createTestingModule({
      providers: [
        BudgetService,
        { provide: BudgetCalculator, useValue: mockCalculator },
        {
          provide: BudgetValidator,
          useValue: {
            validateBudgetInput: (dto: any) => dto,
            validateUpdateBudgetDto: (dto: any) => dto,
            validateNoDuplicatePeriod: () => Promise.resolve(),
          },
        },
        {
          provide: BudgetRepository,
          useValue: {
            fetchBudgetById: () => Promise.resolve(createMockBudgetEntity()),
            fetchBudgetData: () =>
              Promise.resolve({
                budget: null,
                transactions: [],
                budgetLines: [],
              }),
            updateBudgetInDb: () => Promise.resolve(createMockBudgetEntity()),
          },
        },
        {
          provide: `${INFO_LOGGER_TOKEN}:${BudgetService.name}`,
          useValue: mockPinoLogger,
        },
        {
          provide: EncryptionService,
          useValue: {
            getUserDEK: () => Promise.resolve(Buffer.alloc(32)),
            ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
            encryptAmount: () => 'encrypted-mock',
            tryDecryptAmount: (_ct: string, _dek: Buffer, fallback: number) =>
              fallback,
          },
        },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
  });

  describe('getPayDayOfMonth (private method via integration)', () => {
    it('should use payDayOfMonth=1 when user has no payDayOfMonth configured', async () => {
      // Arrange
      mockSupabaseClient.setMockData({
        user_metadata: {},
      });
      const getRolloverSpy = spyOn(mockCalculator, 'getRollover' as any);
      mockSupabaseClient.setMockData([createMockBudgetEntity()]);

      // Act
      await service.findAll(mockUser, mockSupabaseClient as any);

      // Assert
      expect(getRolloverSpy).toHaveBeenCalled();
      const callArgs = getRolloverSpy.mock.calls[0];
      expect(callArgs[1]).toBe(1); // payDayOfMonth defaults to 1
    });

    it('should use payDayOfMonth from user metadata when configured', async () => {
      // Arrange
      const mockAuth = {
        getUser: () =>
          Promise.resolve({
            data: { user: { user_metadata: { payDayOfMonth: 27 } } },
            error: null,
          }),
      };
      const customClient = {
        ...mockSupabaseClient,
        auth: mockAuth,
        from: () => ({
          select: () => ({
            order: () => ({
              order: () =>
                Promise.resolve({
                  data: [createMockBudgetEntity()],
                  error: null,
                }),
            }),
          }),
        }),
      };

      const getRolloverSpy = spyOn(mockCalculator, 'getRollover' as any);

      // Act
      await service.findAll(mockUser, customClient as any);

      // Assert
      expect(getRolloverSpy).toHaveBeenCalled();
      const callArgs = getRolloverSpy.mock.calls[0];
      expect(callArgs[1]).toBe(27); // payDayOfMonth from user metadata
    });

    it('should clamp payDayOfMonth to valid range (1-31)', async () => {
      // Arrange: payDayOfMonth = 50 (invalid, should be clamped to 31)
      const mockAuth = {
        getUser: () =>
          Promise.resolve({
            data: { user: { user_metadata: { payDayOfMonth: 50 } } },
            error: null,
          }),
      };
      const customClient = {
        ...mockSupabaseClient,
        auth: mockAuth,
        from: () => ({
          select: () => ({
            order: () => ({
              order: () =>
                Promise.resolve({
                  data: [createMockBudgetEntity()],
                  error: null,
                }),
            }),
          }),
        }),
      };

      const getRolloverSpy = spyOn(mockCalculator, 'getRollover' as any);

      // Act
      await service.findAll(mockUser, customClient as any);

      // Assert
      expect(getRolloverSpy).toHaveBeenCalled();
      const callArgs = getRolloverSpy.mock.calls[0];
      expect(callArgs[1]).toBe(31); // clamped to max 31
    });

    it('should use default payDay when payDayOfMonth is not a number', async () => {
      // Arrange
      const mockAuth = {
        getUser: () =>
          Promise.resolve({
            data: { user: { user_metadata: { payDayOfMonth: 'invalid' } } },
            error: null,
          }),
      };
      const customClient = {
        ...mockSupabaseClient,
        auth: mockAuth,
        from: () => ({
          select: () => ({
            order: () => ({
              order: () =>
                Promise.resolve({
                  data: [createMockBudgetEntity()],
                  error: null,
                }),
            }),
          }),
        }),
      };

      const getRolloverSpy = spyOn(mockCalculator, 'getRollover' as any);

      // Act
      await service.findAll(mockUser, customClient as any);

      // Assert
      expect(getRolloverSpy).toHaveBeenCalled();
      const callArgs = getRolloverSpy.mock.calls[0];
      expect(callArgs[1]).toBe(1); // defaults to 1 for invalid value
    });
  });
});

describe('BudgetCalculator.getRollover', () => {
  let calculator: BudgetCalculator;

  const mockPinoLogger = createMockPinoLogger();
  const mockEncryptionService = {
    ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
    encryptAmount: () => 'encrypted-mock',
  };

  beforeEach(async () => {
    const mockRepository = {
      fetchBudgetData: () =>
        Promise.resolve({ budget: null, transactions: [], budgetLines: [] }),
    };

    const module = await Test.createTestingModule({
      providers: [
        BudgetCalculator,
        { provide: BudgetRepository, useValue: mockRepository },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: `${INFO_LOGGER_TOKEN}:${BudgetCalculator.name}`,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    calculator = module.get<BudgetCalculator>(BudgetCalculator);
  });

  it('should fetch user_id and query budgets for calendar-based rollover', async () => {
    // Arrange
    const budgetId = '550e8400-e29b-41d4-a716-446655440002';
    const userId = 'user-123';
    const payDayOfMonth = 1;

    const mockClient = {
      from: (table: string) => {
        if (table === 'monthly_budget') {
          return {
            select: (fields: string) => {
              if (fields === 'user_id') {
                return {
                  eq: (col: string, val: string) =>
                    col === 'id' && val === budgetId
                      ? {
                          single: () =>
                            Promise.resolve({
                              data: { user_id: userId },
                              error: null,
                            }),
                        }
                      : undefined,
                };
              }
              if (
                fields ===
                'id, month, year, ending_balance, ending_balance_encrypted'
              ) {
                return {
                  eq: (col: string, val: string) =>
                    col === 'user_id' && val === userId
                      ? Promise.resolve({
                          data: [],
                          error: null,
                        })
                      : undefined,
                };
              }
            },
          };
        }
      },
    };

    // Act
    const result = await calculator.getRollover(
      budgetId,
      payDayOfMonth,
      mockClient as any,
      Buffer.alloc(32),
    );

    // Assert
    expect(result).toEqual({
      rollover: 0,
      previousBudgetId: null,
    });
  });

  it('should calculate rollover from multiple budgets with payDayOfMonth=27', async () => {
    // Arrange
    const budgetId = '550e8400-e29b-41d4-a716-446655440002';
    const previousBudgetId = '550e8400-e29b-41d4-a716-446655440001';
    const userId = 'user-123';
    const payDayOfMonth = 27;

    const budgetsData = [
      { id: previousBudgetId, month: 1, year: 2024, ending_balance: 100 },
      { id: budgetId, month: 2, year: 2024, ending_balance: 150 },
    ];

    const mockClient = {
      from: (table: string) => {
        if (table === 'monthly_budget') {
          return {
            select: (fields: string) => {
              if (fields === 'user_id') {
                return {
                  eq: (col: string, val: string) =>
                    col === 'id' && val === budgetId
                      ? {
                          single: () =>
                            Promise.resolve({
                              data: { user_id: userId },
                              error: null,
                            }),
                        }
                      : undefined,
                };
              }
              if (
                fields ===
                'id, month, year, ending_balance, ending_balance_encrypted'
              ) {
                return {
                  eq: (col: string, val: string) =>
                    col === 'user_id' && val === userId
                      ? Promise.resolve({
                          data: budgetsData,
                          error: null,
                        })
                      : undefined,
                };
              }
            },
          };
        }
      },
    };

    // Act
    const result = await calculator.getRollover(
      budgetId,
      payDayOfMonth,
      mockClient as any,
      Buffer.alloc(32),
    );

    // Assert
    expect(result.rollover).toBe(100);
    expect(result.previousBudgetId).toBe(previousBudgetId);
  });

  it('should return correct rollover data with ending_balance mapping', async () => {
    // Arrange
    const budgetId = '550e8400-e29b-41d4-a716-446655440002';
    const previousBudgetId = '550e8400-e29b-41d4-a716-446655440001';
    const userId = 'user-456';
    const payDayOfMonth = 15;

    const budgetsData = [
      { id: previousBudgetId, month: 12, year: 2023, ending_balance: 200 },
      { id: budgetId, month: 1, year: 2024, ending_balance: 250 },
    ];

    const mockClient = {
      from: (table: string) => {
        if (table === 'monthly_budget') {
          return {
            select: (fields: string) => {
              if (fields === 'user_id') {
                return {
                  eq: (col: string, val: string) =>
                    col === 'id' && val === budgetId
                      ? {
                          single: () =>
                            Promise.resolve({
                              data: { user_id: userId },
                              error: null,
                            }),
                        }
                      : undefined,
                };
              }
              if (
                fields ===
                'id, month, year, ending_balance, ending_balance_encrypted'
              ) {
                return {
                  eq: (col: string, val: string) =>
                    col === 'user_id' && val === userId
                      ? Promise.resolve({
                          data: budgetsData,
                          error: null,
                        })
                      : undefined,
                };
              }
            },
          };
        }
      },
    };

    // Act
    const result = await calculator.getRollover(
      budgetId,
      payDayOfMonth,
      mockClient as any,
      Buffer.alloc(32),
    );

    // Assert
    expect(result).toEqual({
      rollover: 200,
      previousBudgetId,
    });
  });
});
