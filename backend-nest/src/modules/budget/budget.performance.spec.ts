import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { v4 as uuid } from 'uuid';
import { BudgetService } from './budget.service';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  createMockBudgetEntity,
  MockSupabaseClient,
} from '../../test/test-utils-simple';
import type { BudgetCreate } from '@pulpe/shared';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        {
          provide: `PinoLogger:${BudgetService.name}`,
          useValue: mockPinoLogger,
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
      expect(executionTime).toBeLessThan(50);
    });

    it('should perform findOne within performance limits', async () => {
      const budgetId = uuid();
      const mockBudget = createMockBudgetEntity({ id: budgetId });
      // const mockUser = createMockAuthenticatedUser(); // No longer needed

      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      const startTime = Date.now();
      const result = await service.findOne(budgetId, mockSupabaseClient as any);
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
      mockSupabaseClient.rpc = () =>
        Promise.resolve({
          data: {
            budget: mockCreatedBudget,
            transactions_created: 5,
            template_name: 'Test Template',
          },
          error: null,
        });

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
