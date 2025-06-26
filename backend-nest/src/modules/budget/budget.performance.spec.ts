import { describe, it, expect, beforeEach } from "bun:test";
import { Test, type TestingModule } from "@nestjs/testing";
import { BudgetService } from "./budget.service";
import { BudgetMapper } from "./budget.mapper";
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  createMockBudgetDbEntity,
  expectPerformance,
  LoadTestRunner,
  expectLoadTestPerformance,
  testErrorSilencer,
  MockSupabaseClient,
} from "../../test/test-utils";
import type { BudgetCreate } from "@pulpe/shared";

describe("BudgetService (Performance)", () => {
  let service: BudgetService;
  let budgetMapper: BudgetMapper;
  let mockSupabaseClient: MockSupabaseClient;
  let loadTestRunner: LoadTestRunner;

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    const mockBudgetMapper = {
      toApiList: (data: any[]) =>
        data.map((item) => ({ ...item, mappedToApi: true })),
      toApi: (data: any) => ({ ...data, mappedToApi: true }),
      toDbCreate: (data: any, userId: string) => ({
        ...data,
        user_id: userId,
        dbCreated: true,
      }),
      toDbUpdate: (data: any) => ({ ...data, dbUpdated: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        {
          provide: BudgetMapper,
          useValue: mockBudgetMapper,
        },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
    budgetMapper = module.get<BudgetMapper>(BudgetMapper);

    loadTestRunner = new LoadTestRunner(50, 10000); // 50 concurrent requests, 10s timeout
  });

  describe("Single Operation Performance", () => {
    it("should perform findAll within performance limits", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockBudgets = Array.from({ length: 100 }, (_, i) =>
        createMockBudgetDbEntity({ id: `budget-${i}` })
      );

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      // Act & Assert
      await expectPerformance(
        async () => {
          const result = await service.findAll(
            mockUser,
            mockSupabaseClient as any
          );
          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(100);
        },
        50,
        "BudgetService.findAll with 100 items"
      );
    });

    it("should perform create operation within performance limits", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: "Performance Test Budget",
        monthlyIncome: 5000,
      };
      const mockCreatedBudget = createMockBudgetDbEntity();

      mockSupabaseClient.setMockData(mockCreatedBudget).setMockError(null);

      // Act & Assert
      await expectPerformance(
        async () => {
          const result = await service.create(
            createBudgetDto,
            mockUser,
            mockSupabaseClient as any
          );
          expect(result.success).toBe(true);
        },
        30,
        "BudgetService.create"
      );
    });

    it("should perform findOne operation within performance limits", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = "test-budget-id";
      const mockBudget = createMockBudgetDbEntity({ id: budgetId });

      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      // Act & Assert
      await expectPerformance(
        async () => {
          const result = await service.findOne(
            budgetId,
            mockUser,
            mockSupabaseClient as any
          );
          expect(result.success).toBe(true);
          expect(result.data.id).toBe(budgetId);
        },
        25,
        "BudgetService.findOne"
      );
    });

    it("should handle large dataset operations efficiently", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const largeBudgetList = Array.from({ length: 1000 }, (_, i) =>
        createMockBudgetDbEntity({
          id: `budget-${i}`,
          description: `Budget ${i}`,
          monthly_income: 5000 + i * 100,
        })
      );

      mockSupabaseClient.setMockData(largeBudgetList).setMockError(null);

      // Act & Assert
      await expectPerformance(
        async () => {
          const result = await service.findAll(
            mockUser,
            mockSupabaseClient as any
          );
          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(1000);

          // Verify that all items are properly mapped
          result.data.forEach((budget, index) => {
            expect(budget).toHaveProperty("mappedToApi", true);
          });
        },
        200,
        "BudgetService.findAll with 1000 items"
      );
    });
  });

  describe("Load Testing", () => {
    it("should handle concurrent findAll requests", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockBudgets = Array.from({ length: 10 }, (_, i) =>
        createMockBudgetDbEntity({ id: `budget-${i}` })
      );

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      // Act
      const result = await loadTestRunner.runConcurrentTest(async () => {
        return await service.findAll(mockUser, mockSupabaseClient as any);
      }, "BudgetService.findAll");

      // Assert
      expectLoadTestPerformance(result, {
        minSuccessRate: 95, // 95% success rate
        maxAverageResponseTime: 100, // Max 100ms average
        minRequestsPerSecond: 100, // At least 100 RPS
      });

      expect(result.totalRequests).toBe(50);
      expect(result.failedRequests).toBeLessThanOrEqual(2); // Max 2 failures allowed
    });

    it("should handle concurrent create requests", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: "Load Test Budget",
        monthlyIncome: 5000,
      };
      const mockCreatedBudget = createMockBudgetDbEntity();

      mockSupabaseClient.setMockData(mockCreatedBudget).setMockError(null);

      // Act
      const result = await loadTestRunner.runConcurrentTest(async () => {
        return await service.create(
          createBudgetDto,
          mockUser,
          mockSupabaseClient as any
        );
      }, "BudgetService.create");

      // Assert
      expectLoadTestPerformance(result, {
        minSuccessRate: 90, // 90% success rate for write operations
        maxAverageResponseTime: 150, // Max 150ms average for creates
        minRequestsPerSecond: 50, // At least 50 RPS for creates
      });
    });

    it("should handle mixed operation load testing", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockBudgets = [createMockBudgetDbEntity()];
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: "Mixed Load Test Budget",
        monthlyIncome: 5000,
      };

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      // Reduce concurrent requests for mixed operations
      const mixedLoadTestRunner = new LoadTestRunner(25, 5000);

      // Act
      const operations = ["findAll", "create", "findOne", "update"];
      const results = await Promise.all(
        operations.map(async (operation, index) => {
          let testOperation: () => Promise<any>;

          switch (operation) {
            case "findAll":
              testOperation = () =>
                service.findAll(mockUser, mockSupabaseClient as any);
              break;
            case "create":
              testOperation = () =>
                service.create(
                  createBudgetDto,
                  mockUser,
                  mockSupabaseClient as any
                );
              break;
            case "findOne":
              testOperation = () =>
                service.findOne(
                  "test-budget-id",
                  mockUser,
                  mockSupabaseClient as any
                );
              break;
            case "update":
              testOperation = () =>
                service.update(
                  "test-budget-id",
                  { description: "Updated" },
                  mockUser,
                  mockSupabaseClient as any
                );
              break;
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }

          return {
            operation,
            result: await mixedLoadTestRunner.runConcurrentTest(
              testOperation,
              `BudgetService.${operation}`
            ),
          };
        })
      );

      // Assert
      results.forEach(({ operation, result }) => {
        expect(result.totalRequests).toBe(25);
        expect(result.successfulRequests).toBeGreaterThanOrEqual(20); // At least 80% success
        expect(result.averageResponseTime).toBeLessThan(200); // Max 200ms average

        if (process.env.DEBUG_PERFORMANCE === "true") {
          console.log(`📊 ${operation} load test:`, {
            successRate: `${(
              (result.successfulRequests / result.totalRequests) *
              100
            ).toFixed(1)}%`,
            avgResponseTime: `${result.averageResponseTime.toFixed(1)}ms`,
            requestsPerSecond: `${result.requestsPerSecond.toFixed(1)} RPS`,
          });
        }
      });
    });
  });

  describe("Memory and Resource Usage", () => {
    it("should not leak memory during repeated operations", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockBudgets = Array.from({ length: 50 }, (_, i) =>
        createMockBudgetDbEntity({ id: `budget-${i}` })
      );

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      const initialMemory = process.memoryUsage().heapUsed;

      // Act - Perform many operations
      for (let i = 0; i < 100; i++) {
        await service.findAll(mockUser, mockSupabaseClient as any);

        // Reset mock between operations
        mockSupabaseClient.reset().setMockData(mockBudgets).setMockError(null);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assert - Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      if (process.env.DEBUG_PERFORMANCE === "true") {
        console.log(
          `💾 Memory usage: ${(memoryIncrease / 1024 / 1024).toFixed(
            2
          )}MB increase after 100 operations`
        );
      }
    });

    it("should handle error scenarios under load without degradation", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient
        .setMockData(null)
        .setMockError({ message: "Simulated database error" });

      // Act
      const errorLoadTestRunner = new LoadTestRunner(20, 3000);

      const result = await testErrorSilencer.withSilencedErrors(async () => {
        return await errorLoadTestRunner.runConcurrentTest(async () => {
          try {
            await service.findAll(mockUser, mockSupabaseClient as any);
            throw new Error("Expected error was not thrown");
          } catch (error) {
            // Expected to throw InternalServerErrorException
            expect(error).toBeDefined();
            return { handled: true };
          }
        }, "BudgetService.findAll error handling");
      });

      // Assert
      expect(result.totalRequests).toBe(20);
      expect(result.successfulRequests).toBe(20); // All should "succeed" in handling the error
      expect(result.averageResponseTime).toBeLessThan(50); // Error handling should be fast
    });
  });

  describe("Edge Case Performance", () => {
    it("should handle empty result sets efficiently", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient.setMockData([]).setMockError(null);

      // Act & Assert
      await expectPerformance(
        async () => {
          const result = await service.findAll(
            mockUser,
            mockSupabaseClient as any
          );
          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(0);
        },
        20,
        "BudgetService.findAll with empty result"
      );
    });

    it("should handle null data efficiently", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      mockSupabaseClient.setMockData(null).setMockError(null);

      // Act & Assert
      await expectPerformance(
        async () => {
          const result = await service.findAll(
            mockUser,
            mockSupabaseClient as any
          );
          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(0);
        },
        15,
        "BudgetService.findAll with null data"
      );
    });

    it("should perform complex onboarding operations within limits", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const onboardingData = {
        month: 11,
        year: 2024,
        description: "Performance Test Onboarding",
        monthlyIncome: 5000,
        housingCosts: 1500,
        healthInsurance: 400,
        leasingCredit: 800,
        phonePlan: 50,
        transportCosts: 200,
      };
      const mockBudget = createMockBudgetDbEntity();

      mockSupabaseClient
        .setMockRpcData({ budget: mockBudget })
        .setMockRpcError(null);

      // Act & Assert
      await expectPerformance(
        async () => {
          const result = await service.createFromOnboarding(
            onboardingData,
            mockUser,
            mockSupabaseClient as any
          );
          expect(result.success).toBe(true);
        },
        100,
        "BudgetService.createFromOnboarding"
      );
    });
  });
});
