import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { v4 as uuid } from 'uuid';
import { BudgetService } from './budget.service';
import { BudgetCalculator } from './budget.calculator';
import { BudgetValidator } from './budget.validator';
import { BudgetRepository } from './budget.repository';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  createMockBudgetEntity,
  MockSupabaseClient,
} from '../../test/test-mocks';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { CacheService } from '@modules/cache/cache.service';
import type { BudgetCreate } from 'pulpe-shared';

describe('BudgetService (Performance)', () => {
  let service: BudgetService;
  let mockSupabaseClient: MockSupabaseClient;

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    const mockPinoLogger = {
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };

    const mockCalculator = {
      calculateEndingBalance: () => Promise.resolve(100),
      recalculateAndPersist: () => Promise.resolve(),
      getRollover: () =>
        Promise.resolve({ rollover: 50, previousBudgetId: 'prev-id' }),
      buildRolloverLine: () => ({
        id: 'rollover-id',
        budgetId: 'budget-id',
        templateLineId: null,
        savingsGoalId: null,
        name: 'Rollover from previous month',
        amount: 50,
        kind: 'income',
        recurrence: 'one_off',
        isManuallyAdjusted: false,
        isRollover: true,
        rolloverSourceBudgetId: 'prev-id',
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      }),
    };

    const mockValidator = {
      validateBudgetInput: (dto: any) => dto,
      validateUpdateBudgetDto: (dto: any) => dto,
      validateNoDuplicatePeriod: () => Promise.resolve(),
    };

    const mockRepository = {
      fetchBudgetById: (id: string) =>
        Promise.resolve(createMockBudgetEntity({ id })),
      updateBudgetInDb: (id: string, updateData: any) =>
        Promise.resolve(createMockBudgetEntity({ id, ...updateData })),
      fetchBudgetData: () =>
        Promise.resolve({
          budget: createMockBudgetEntity(),
          budgetLines: [],
          transactions: [],
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        {
          provide: `INFO_LOGGER:${BudgetService.name}`,
          useValue: mockPinoLogger,
        },
        {
          provide: BudgetCalculator,
          useValue: mockCalculator,
        },
        {
          provide: BudgetValidator,
          useValue: mockValidator,
        },
        {
          provide: BudgetRepository,
          useValue: mockRepository,
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
        {
          provide: CacheService,
          useValue: {
            getOrSet: (
              _userId: string,
              _key: string,
              _ttl: number,
              fetcher: () => Promise<unknown>,
            ) => fetcher(),
            invalidateForUser: () => Promise.resolve(),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
  });

  describe('Basic Performance Tests', () => {
    it('should perform findAll within performance limits', async () => {
      const mockBudgets = Array.from({ length: 100 }, () =>
        createMockBudgetEntity({ id: uuid() }),
      );

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      const startTime = Date.now();
      const result = await service.findAll(
        createMockAuthenticatedUser(),
        mockSupabaseClient as any,
      );
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(100);
      expect(executionTime).toBeLessThan(150);
    });

    it('should perform findOne within performance limits', async () => {
      const budgetId = uuid();
      const mockBudget = createMockBudgetEntity({ id: budgetId });
      const mockUser = createMockAuthenticatedUser();

      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      const startTime = Date.now();
      const result = await service.findOne(
        budgetId,
        mockUser,
        mockSupabaseClient as any,
      );
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(budgetId);
      expect(executionTime).toBeLessThan(25);
    });

    it('should handle large datasets efficiently', async () => {
      const largeBudgetList = Array.from({ length: 1000 }, (_, index) =>
        createMockBudgetEntity({
          id: uuid(),
          description: `Budget ${index}`,
          month: (index % 12) + 1,
          year: 2024,
        }),
      );

      mockSupabaseClient.setMockData(largeBudgetList).setMockError(null);

      const startTime = Date.now();
      const result = await service.findAll(
        createMockAuthenticatedUser(),
        mockSupabaseClient as any,
      );
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1000);
      expect(executionTime).toBeLessThan(200);
    });
  });

  describe('Load Testing', () => {
    it('should handle concurrent findAll requests', async () => {
      const mockBudgets = Array.from({ length: 10 }, () =>
        createMockBudgetEntity({ id: uuid() }),
      );

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      const concurrentRequests = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        service.findAll(
          createMockAuthenticatedUser(),
          mockSupabaseClient as any,
        ),
      );

      const results = await Promise.allSettled(promises);
      const totalDuration = Date.now() - startTime;

      const successCount = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const failureCount = results.filter(
        (r) => r.status === 'rejected',
      ).length;
      const successRate = (successCount / concurrentRequests) * 100;

      expect(successRate).toBeGreaterThanOrEqual(95);
      expect(failureCount).toBeLessThanOrEqual(2);
      expect(totalDuration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent create requests', async () => {
      const mockUser = createMockAuthenticatedUser(); // Still needed for create method

      // Generate unique DTOs for each request to avoid duplicate period validation
      let requestCounter = 0;
      const createBudgetDtoGenerator = () => {
        requestCounter++;
        // Keep year within allowed range (current year + 1 to stay within 2 years limit)
        const currentYear = new Date().getFullYear();
        return {
          month: (requestCounter % 12) + 1, // Cycle through months 1-12
          year: currentYear + (requestCounter % 2), // Alternate between current and next year
          description: `Load Test Budget ${requestCounter}`,
          templateId: `template-id-${requestCounter}`,
        } as BudgetCreate;
      };

      const mockCreatedBudget = createMockBudgetEntity({
        month: 1,
        year: 2025,
      });

      // Mock RPC function to always succeed
      (mockSupabaseClient.rpc as any) = () => {
        const result = {
          data: {
            budget: mockCreatedBudget,
            budget_lines_created: 5,
            template_name: 'Test Template',
          },
          error: null,
        };
        return {
          single: () => Promise.resolve(result),
          eq: () => ({ single: () => Promise.resolve(result) }),
          neq: () => ({ single: () => Promise.resolve(result) }),
          gte: () => ({ single: () => Promise.resolve(result) }),
          lte: () => ({ single: () => Promise.resolve(result) }),
          gt: () => ({ single: () => Promise.resolve(result) }),
          lt: () => ({ single: () => Promise.resolve(result) }),
          in: () => ({ single: () => Promise.resolve(result) }),
          limit: () => ({ single: () => Promise.resolve(result) }),
          range: () => ({ single: () => Promise.resolve(result) }),
          then: (resolve: (value: typeof result) => any) =>
            Promise.resolve(result).then(resolve),
        };
      };

      // Setup simple mocks for concurrent operations
      const originalFrom = mockSupabaseClient.from;

      mockSupabaseClient.from = (table: string) => {
        const chainMethods = originalFrom.call(mockSupabaseClient, table);

        // Always return null for validation (no duplicate)
        chainMethods.single = () =>
          Promise.resolve({ data: null, error: null });

        return chainMethods;
      };

      const concurrentRequests = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () => {
        const dto = createBudgetDtoGenerator();
        return service.create(dto, mockUser, mockSupabaseClient as any);
      });

      const results = await Promise.allSettled(promises);
      const totalDuration = Date.now() - startTime;

      const successCount = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const successRate = (successCount / concurrentRequests) * 100;

      expect(successRate).toBeGreaterThanOrEqual(90);
      expect(totalDuration).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results efficiently', async () => {
      mockSupabaseClient.setMockData([]).setMockError(null);

      const startTime = Date.now();
      const result = await service.findAll(
        createMockAuthenticatedUser(),
        mockSupabaseClient as any,
      );
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(executionTime).toBeLessThan(20);
    });

    it('should handle null data efficiently', async () => {
      mockSupabaseClient.setMockData(null).setMockError(null);

      const startTime = Date.now();
      const result = await service.findAll(
        createMockAuthenticatedUser(),
        mockSupabaseClient as any,
      );
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(executionTime).toBeLessThan(15);
    });
  });
});
