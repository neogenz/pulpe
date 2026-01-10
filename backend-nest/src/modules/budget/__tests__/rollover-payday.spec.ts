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
import { getLoggerToken } from 'nestjs-pino';

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
          provide: getLoggerToken(BudgetService.name),
          useValue: mockPinoLogger,
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
  let mockSupabaseClient: MockSupabaseClient;
  let rpcSpy: ReturnType<typeof spyOn>;

  const mockPinoLogger = createMockPinoLogger();

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    const mockRepository = {
      fetchBudgetData: () =>
        Promise.resolve({ budget: null, transactions: [], budgetLines: [] }),
    };

    const module = await Test.createTestingModule({
      providers: [
        BudgetCalculator,
        { provide: BudgetRepository, useValue: mockRepository },
        {
          provide: getLoggerToken(BudgetCalculator.name),
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    calculator = module.get<BudgetCalculator>(BudgetCalculator);
  });

  it('should pass payDayOfMonth=1 to RPC for calendar-based rollover', async () => {
    // Arrange
    const budgetId = '550e8400-e29b-41d4-a716-446655440002';
    const payDayOfMonth = 1;
    const mockRpcResponse = {
      ending_balance: 100,
      rollover: 50,
      available_to_spend: 150,
      previous_budget_id: null,
    };

    rpcSpy = spyOn(mockSupabaseClient, 'rpc');
    mockSupabaseClient.setMockData(mockRpcResponse);

    // Act
    await calculator.getRollover(
      budgetId,
      payDayOfMonth,
      mockSupabaseClient as any,
    );

    // Assert
    expect(rpcSpy).toHaveBeenCalledWith('get_budget_with_rollover', {
      p_budget_id: budgetId,
      p_pay_day_of_month: 1,
    });
  });

  it('should pass payDayOfMonth=27 to RPC for pay-period-based rollover', async () => {
    // Arrange
    const budgetId = '550e8400-e29b-41d4-a716-446655440002';
    const payDayOfMonth = 27;
    const mockRpcResponse = {
      ending_balance: 100,
      rollover: 75,
      available_to_spend: 175,
      previous_budget_id: '550e8400-e29b-41d4-a716-446655440001',
    };

    rpcSpy = spyOn(mockSupabaseClient, 'rpc');
    mockSupabaseClient.setMockData(mockRpcResponse);

    // Act
    const result = await calculator.getRollover(
      budgetId,
      payDayOfMonth,
      mockSupabaseClient as any,
    );

    // Assert
    expect(rpcSpy).toHaveBeenCalledWith('get_budget_with_rollover', {
      p_budget_id: budgetId,
      p_pay_day_of_month: 27,
    });
    expect(result.rollover).toBe(75);
    expect(result.previousBudgetId).toBe(
      '550e8400-e29b-41d4-a716-446655440001',
    );
  });

  it('should return correct rollover data from RPC response', async () => {
    // Arrange
    const budgetId = '550e8400-e29b-41d4-a716-446655440002';
    const previousBudgetId = '550e8400-e29b-41d4-a716-446655440001';
    const payDayOfMonth = 15;
    const mockRpcResponse = {
      ending_balance: 200,
      rollover: 150,
      available_to_spend: 350,
      previous_budget_id: previousBudgetId,
    };

    // Create a custom mock that returns the data correctly
    const customClient = {
      rpc: () => ({
        single: () =>
          Promise.resolve({
            data: mockRpcResponse,
            error: null,
          }),
      }),
    };

    // Act
    const result = await calculator.getRollover(
      budgetId,
      payDayOfMonth,
      customClient as any,
    );

    // Assert
    expect(result).toEqual({
      rollover: 150,
      previousBudgetId,
    });
  });
});
