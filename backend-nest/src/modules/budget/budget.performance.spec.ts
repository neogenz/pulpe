import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { v4 as uuid } from 'uuid';
import { BudgetService } from './budget.service';
import { BudgetMapper } from './budget.mapper';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  createMockBudgetEntity,
  expectPerformance,
  LoadTestRunner,
  expectLoadTestPerformance,
  MockSupabaseClient,
} from '../../test/test-utils';
import type { BudgetCreate } from '@pulpe/shared';

describe('BudgetService (Performance)', () => {
  let service: BudgetService;
  let mockSupabaseClient: MockSupabaseClient;
  let loadTestRunner: LoadTestRunner;

  const simpleBudgetMapper = {
    toApiList: (data: any[]) =>
      data.map((item) => ({ ...item, mappedToApi: true })),
    toApi: (data: any) => ({ ...data, mappedToApi: true }),
    toInsert: (data: any, userId: string) => ({ ...data, user_id: userId }),
    toUpdate: (data: any) => ({ ...data }),
  };

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        { provide: BudgetMapper, useValue: simpleBudgetMapper },
        {
          provide: `PinoLogger:${BudgetService.name}`,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
    loadTestRunner = new LoadTestRunner(50, 10000);
  });

  describe('Basic Performance Tests', () => {
    it('should perform findAll within performance limits', async () => {
      const mockBudgets = Array.from({ length: 100 }, () =>
        createMockBudgetEntity({ id: uuid() }),
      );

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      await expectPerformance(
        async () => {
          const result = await service.findAll(mockSupabaseClient as any);
          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(100);
        },
        50,
        'BudgetService.findAll with 100 items',
      );
    });

    it('should perform findOne within performance limits', async () => {
      const budgetId = uuid();
      const mockBudget = createMockBudgetEntity({ id: budgetId });
      const mockUser = createMockAuthenticatedUser();

      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      await expectPerformance(
        async () => {
          const result = await service.findOne(
            budgetId,
            mockUser,
            mockSupabaseClient as any,
          );
          expect(result.success).toBe(true);
          expect(result.data.id).toBe(budgetId);
        },
        25,
        'BudgetService.findOne',
      );
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

      await expectPerformance(
        async () => {
          const result = await service.findAll(mockSupabaseClient as any);
          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(1000);
        },
        200,
        'BudgetService.findAll with 1000 items',
      );
    });
  });

  describe('Load Testing', () => {
    it('should handle concurrent findAll requests', async () => {
      const mockBudgets = Array.from({ length: 10 }, () =>
        createMockBudgetEntity({ id: uuid() }),
      );

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      const result = await loadTestRunner.runConcurrentTest(
        async () => service.findAll(mockSupabaseClient as any),
        'BudgetService.findAll',
      );

      expectLoadTestPerformance(result, {
        minSuccessRate: 95,
        maxAverageResponseTime: 100,
        minRequestsPerSecond: 100,
      });

      expect(result.totalRequests).toBe(50);
      expect(result.failedRequests).toBeLessThanOrEqual(2);
    });

    it('should handle concurrent create requests', async () => {
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto: BudgetCreate = {
        month: 2,
        year: 2025,
        description: 'Load Test Budget',
      };
      const mockCreatedBudget = createMockBudgetEntity({
        month: 2,
        year: 2025,
      });

      // Setup simple mocks for concurrent operations
      const originalFrom = mockSupabaseClient.from;

      mockSupabaseClient.from = (table: string) => {
        const chainMethods = originalFrom.call(mockSupabaseClient, table);

        // Always return null for validation (no duplicate)
        chainMethods.single = () =>
          Promise.resolve({ data: null, error: null });

        // Always return created budget for insert
        chainMethods.insert = () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: mockCreatedBudget, error: null }),
          }),
        });

        return chainMethods;
      };

      const result = await loadTestRunner.runConcurrentTest(
        async () =>
          service.create(createBudgetDto, mockUser, mockSupabaseClient as any),
        'BudgetService.create',
      );

      expectLoadTestPerformance(result, {
        minSuccessRate: 90,
        maxAverageResponseTime: 150,
        minRequestsPerSecond: 50,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results efficiently', async () => {
      mockSupabaseClient.setMockData([]).setMockError(null);

      await expectPerformance(
        async () => {
          const result = await service.findAll(mockSupabaseClient as any);
          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(0);
        },
        20,
        'BudgetService.findAll with empty result',
      );
    });

    it('should handle null data efficiently', async () => {
      mockSupabaseClient.setMockData(null).setMockError(null);

      await expectPerformance(
        async () => {
          const result = await service.findAll(mockSupabaseClient as any);
          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(0);
        },
        15,
        'BudgetService.findAll with null data',
      );
    });
  });
});
