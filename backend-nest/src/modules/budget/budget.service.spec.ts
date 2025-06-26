import { describe, it, expect, beforeEach } from "bun:test";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { BudgetService } from "./budget.service";
import { BudgetMapper } from "./budget.mapper";
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  createMockBudgetDbEntity,
  expectSuccessResponse,
  expectErrorThrown,
  expectBudgetStructure,
  expectListResponse,
  expectPerformance,
  testErrorSilencer,
  MOCK_USER_ID,
  MOCK_BUDGET_ID,
  MockSupabaseClient,
} from "../../test/test-utils";
import type {
  BudgetCreate,
  BudgetUpdate,
  BudgetCreateFromOnboarding,
} from "@pulpe/shared";

describe("BudgetService", () => {
  let service: BudgetService;
  let budgetMapper: BudgetMapper;
  let mockSupabaseClient: MockSupabaseClient;

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
  });

  describe("findAll", () => {
    it("should return all budgets for authenticated user successfully with performance check", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockBudgets = [
        createMockBudgetDbEntity(),
        createMockBudgetDbEntity({ id: "budget-2" }),
      ];

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      // Act & Assert
      await expectPerformance(
        async () => {
          const result = await service.findAll(
            mockUser,
            mockSupabaseClient as any
          );

          expectListResponse(
            result,
            (budget: any) => {
              expect(budget).toHaveProperty("mappedToApi", true);
            },
            2
          );
          expect(result.data[0]).toHaveProperty("mappedToApi", true);
        },
        30,
        "BudgetService.findAll"
      );
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockError = { message: "Database connection failed" };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () => service.findAll(mockUser, mockSupabaseClient as any),
        InternalServerErrorException,
        "Erreur lors de la récupération des budgets"
      );
    });

    it("should handle empty budget list", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();

      mockSupabaseClient.setMockData([]).setMockError(null);

      // Act
      const result = await service.findAll(mockUser, mockSupabaseClient as any);

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveLength(0);
    });

    it("should handle null data from database", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();

      mockSupabaseClient.setMockData(null).setMockError(null);

      // Act
      const result = await service.findAll(mockUser, mockSupabaseClient as any);

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveLength(0);
    });
  });

  describe("create", () => {
    it("should create budget successfully", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: "Test Budget",
        monthlyIncome: 5000,
      };
      const mockCreatedBudget = createMockBudgetDbEntity();

      mockSupabaseClient.setMockData(mockCreatedBudget).setMockError(null);

      // Act
      const result = await service.create(
        createBudgetDto,
        mockUser,
        mockSupabaseClient as any
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty("mappedToApi", true);
    });

    it("should handle database creation error", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: "Test Budget",
        monthlyIncome: 5000,
      };
      const mockError = { message: "Constraint violation" };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.create(createBudgetDto, mockUser, mockSupabaseClient as any),
        BadRequestException,
        "Erreur lors de la création du budget"
      );
    });

    it("should handle unexpected errors during creation", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: "Test Budget",
        monthlyIncome: 5000,
      };

      // Mock a rejected promise to simulate unexpected error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error("Unexpected error");
      };

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.create(createBudgetDto, mockUser, mockSupabaseClient as any),
        InternalServerErrorException,
        "Erreur interne du serveur"
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe("findOne", () => {
    it("should return specific budget successfully", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const mockBudget = createMockBudgetDbEntity();

      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      // Act
      const result = await service.findOne(
        budgetId,
        mockUser,
        mockSupabaseClient as any
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty("mappedToApi", true);
    });

    it("should throw NotFoundException when budget not found", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = "non-existent-id";
      const mockError = { message: "No rows returned" };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () => service.findOne(budgetId, mockUser, mockSupabaseClient as any),
        NotFoundException,
        "Budget introuvable ou accès non autorisé"
      );
    });

    it("should handle database error when finding budget", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;

      // Mock a rejected promise to simulate database error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error("Database error");
      };

      // Act & Assert
      await expectErrorThrown(
        () => service.findOne(budgetId, mockUser, mockSupabaseClient as any),
        InternalServerErrorException,
        "Erreur interne du serveur"
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe("update", () => {
    it("should update budget successfully", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const updateBudgetDto: BudgetUpdate = {
        description: "Updated Budget",
        monthlyIncome: 6000,
      };
      const mockUpdatedBudget = createMockBudgetDbEntity(updateBudgetDto);

      mockSupabaseClient.setMockData(mockUpdatedBudget).setMockError(null);

      // Act
      const result = await service.update(
        budgetId,
        updateBudgetDto,
        mockUser,
        mockSupabaseClient as any
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty("mappedToApi", true);
    });

    it("should throw NotFoundException when updating non-existent budget", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = "non-existent-id";
      const updateBudgetDto: BudgetUpdate = {
        description: "Updated Budget",
      };
      const mockError = { message: "No rows returned" };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.update(
            budgetId,
            updateBudgetDto,
            mockUser,
            mockSupabaseClient as any
          ),
        NotFoundException,
        "Budget introuvable ou modification non autorisée"
      );
    });

    it("should handle unexpected errors during update", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const updateBudgetDto: BudgetUpdate = {
        description: "Updated Budget",
      };

      // Mock a rejected promise to simulate unexpected error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error("Database connection lost");
      };

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.update(
            budgetId,
            updateBudgetDto,
            mockUser,
            mockSupabaseClient as any
          ),
        InternalServerErrorException,
        "Erreur interne du serveur"
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe("remove", () => {
    it("should delete budget successfully", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;

      mockSupabaseClient.setMockError(null);

      // Act
      const result = await service.remove(
        budgetId,
        mockUser,
        mockSupabaseClient as any
      );

      // Assert
      expect(result).toEqual({
        success: true,
        message: "Budget supprimé avec succès",
      });
    });

    it("should throw NotFoundException when deleting non-existent budget", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = "non-existent-id";
      const mockError = { message: "No rows affected" };

      mockSupabaseClient.setMockError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () => service.remove(budgetId, mockUser, mockSupabaseClient as any),
        NotFoundException,
        "Budget introuvable ou suppression non autorisée"
      );
    });

    it("should handle unexpected errors during deletion", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;

      // Mock a rejected promise to simulate unexpected error
      const originalMethod = mockSupabaseClient.from;
      mockSupabaseClient.from = () => {
        throw new Error("Database error");
      };

      // Act & Assert
      await expectErrorThrown(
        () => service.remove(budgetId, mockUser, mockSupabaseClient as any),
        InternalServerErrorException,
        "Erreur interne du serveur"
      );

      // Restore
      mockSupabaseClient.from = originalMethod;
    });
  });

  describe("createFromOnboarding", () => {
    it("should create budget from onboarding data successfully", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const onboardingData: BudgetCreateFromOnboarding = {
        month: 11,
        year: 2024,
        description: "Onboarding Budget",
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

      // Act
      const result = await service.createFromOnboarding(
        onboardingData,
        mockUser,
        mockSupabaseClient as any
      );

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty("mappedToApi", true);
    });

    it("should throw BadRequestException when RPC fails", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const onboardingData: BudgetCreateFromOnboarding = {
        month: 11,
        year: 2024,
        description: "Onboarding Budget",
        monthlyIncome: 5000,
        housingCosts: 1500,
        healthInsurance: 400,
        leasingCredit: 800,
        phonePlan: 50,
        transportCosts: 200,
      };
      const mockError = { message: "RPC execution failed" };

      mockSupabaseClient.setMockRpcData(null).setMockRpcError(mockError);

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.createFromOnboarding(
            onboardingData,
            mockUser,
            mockSupabaseClient as any
          ),
        BadRequestException,
        "Erreur lors de la création du budget et des transactions"
      );
    });

    it("should throw InternalServerErrorException when no budget returned", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const onboardingData: BudgetCreateFromOnboarding = {
        month: 11,
        year: 2024,
        description: "Onboarding Budget",
        monthlyIncome: 5000,
        housingCosts: 1500,
        healthInsurance: 400,
        leasingCredit: 800,
        phonePlan: 50,
        transportCosts: 200,
      };

      mockSupabaseClient.setMockRpcData({ budget: null }).setMockRpcError(null);

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.createFromOnboarding(
            onboardingData,
            mockUser,
            mockSupabaseClient as any
          ),
        InternalServerErrorException,
        "Aucun budget retourné par la fonction"
      );
    });

    it("should handle unexpected errors during onboarding creation", async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const onboardingData: BudgetCreateFromOnboarding = {
        month: 11,
        year: 2024,
        description: "Onboarding Budget",
        monthlyIncome: 5000,
        housingCosts: 1500,
        healthInsurance: 400,
        leasingCredit: 800,
        phonePlan: 50,
        transportCosts: 200,
      };

      // Mock a rejected promise to simulate unexpected error
      const originalRpc = mockSupabaseClient.rpc;
      mockSupabaseClient.rpc = () => Promise.reject(new Error("Network error"));

      // Act & Assert
      await expectErrorThrown(
        () =>
          service.createFromOnboarding(
            onboardingData,
            mockUser,
            mockSupabaseClient as any
          ),
        InternalServerErrorException,
        "Erreur interne du serveur"
      );

      // Restore
      mockSupabaseClient.rpc = originalRpc;
    });
  });
});
