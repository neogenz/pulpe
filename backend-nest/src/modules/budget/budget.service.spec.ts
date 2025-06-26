import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { 
  BadRequestException, 
  InternalServerErrorException, 
  NotFoundException 
} from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetMapper } from './budget.mapper';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  createMockBudgetDbEntity,
  expectSuccessResponse,
  expectErrorThrown,
  MOCK_USER_ID,
  MOCK_BUDGET_ID,
} from '../../test/test-utils';
import type { BudgetCreate, BudgetUpdate, BudgetCreateFromOnboarding } from '@pulpe/shared';

describe('BudgetService', () => {
  let service: BudgetService;
  let budgetMapper: BudgetMapper;
  let mockSupabaseClient: any;
  let mockSupabaseMethods: any;

  beforeEach(async () => {
    const mockSupabaseSetup = createMockSupabaseClient();
    mockSupabaseClient = mockSupabaseSetup.client;
    mockSupabaseMethods = mockSupabaseSetup.mocks;

    const mockBudgetMapper = {
      toApiList: (data: any[]) => data.map(item => ({ ...item, mappedToApi: true })),
      toApi: (data: any) => ({ ...data, mappedToApi: true }),
      toDbCreate: (data: any, userId: string) => ({ ...data, user_id: userId, dbCreated: true }),
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

  describe('findAll', () => {
    it('should return all budgets for authenticated user successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockBudgets = [createMockBudgetDbEntity(), createMockBudgetDbEntity({ id: 'budget-2' })];
      
      mockSupabaseMethods.single.mockResolvedValue({ data: mockBudgets, error: null });

      // Act
      const result = await service.findAll(mockUser, mockSupabaseClient);

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('mappedToApi', true);
      expect(mockSupabaseMethods.from).toHaveBeenCalledWith('budgets');
      expect(mockSupabaseMethods.select).toHaveBeenCalledWith('*');
      expect(mockSupabaseMethods.order).toHaveBeenCalledWith('year', { ascending: false });
      expect(mockSupabaseMethods.order).toHaveBeenCalledWith('month', { ascending: false });
    });

    it('should handle database error gracefully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const mockError = { message: 'Database connection failed' };
      
      mockSupabaseMethods.single.mockResolvedValue({ data: null, error: mockError });

      // Act & Assert
      await expectErrorThrown(
        () => service.findAll(mockUser, mockSupabaseClient),
        InternalServerErrorException,
        'Erreur lors de la récupération des budgets'
      );
    });

    it('should handle empty budget list', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      
      mockSupabaseMethods.single.mockResolvedValue({ data: [], error: null });

      // Act
      const result = await service.findAll(mockUser, mockSupabaseClient);

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveLength(0);
    });

    it('should handle null data from database', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      
      mockSupabaseMethods.single.mockResolvedValue({ data: null, error: null });

      // Act
      const result = await service.findAll(mockUser, mockSupabaseClient);

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('should create budget successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: 'Test Budget',
        monthlyIncome: 5000,
      };
      const mockCreatedBudget = createMockBudgetDbEntity();
      
      mockSupabaseMethods.single.mockResolvedValue({ data: mockCreatedBudget, error: null });

      // Act
      const result = await service.create(createBudgetDto, mockUser, mockSupabaseClient);

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty('mappedToApi', true);
      expect(mockSupabaseMethods.from).toHaveBeenCalledWith('budgets');
      expect(mockSupabaseMethods.insert).toHaveBeenCalled();
      expect(mockSupabaseMethods.select).toHaveBeenCalled();
      expect(mockSupabaseMethods.single).toHaveBeenCalled();
    });

    it('should handle database creation error', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: 'Test Budget',
        monthlyIncome: 5000,
      };
      const mockError = { message: 'Constraint violation' };
      
      mockSupabaseMethods.single.mockResolvedValue({ data: null, error: mockError });

      // Act & Assert
      await expectErrorThrown(
        () => service.create(createBudgetDto, mockUser, mockSupabaseClient),
        BadRequestException,
        'Erreur lors de la création du budget'
      );
    });

    it('should handle unexpected errors during creation', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: 'Test Budget',
        monthlyIncome: 5000,
      };
      
      mockSupabaseMethods.single.mockRejectedValue(new Error('Unexpected error'));

      // Act & Assert
      await expectErrorThrown(
        () => service.create(createBudgetDto, mockUser, mockSupabaseClient),
        InternalServerErrorException,
        'Erreur interne du serveur'
      );
    });
  });

  describe('findOne', () => {
    it('should return specific budget successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const mockBudget = createMockBudgetDbEntity();
      
      mockSupabaseMethods.single.mockResolvedValue({ data: mockBudget, error: null });

      // Act
      const result = await service.findOne(budgetId, mockUser, mockSupabaseClient);

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty('mappedToApi', true);
      expect(mockSupabaseMethods.from).toHaveBeenCalledWith('budgets');
      expect(mockSupabaseMethods.select).toHaveBeenCalledWith('*');
      expect(mockSupabaseMethods.eq).toHaveBeenCalledWith('id', budgetId);
      expect(mockSupabaseMethods.single).toHaveBeenCalled();
    });

    it('should throw NotFoundException when budget not found', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = 'non-existent-id';
      const mockError = { message: 'No rows returned' };
      
      mockSupabaseMethods.single.mockResolvedValue({ data: null, error: mockError });

      // Act & Assert
      await expectErrorThrown(
        () => service.findOne(budgetId, mockUser, mockSupabaseClient),
        NotFoundException,
        'Budget introuvable ou accès non autorisé'
      );
    });

    it('should handle database error when finding budget', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      
      mockSupabaseMethods.single.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expectErrorThrown(
        () => service.findOne(budgetId, mockUser, mockSupabaseClient),
        InternalServerErrorException,
        'Erreur interne du serveur'
      );
    });
  });

  describe('update', () => {
    it('should update budget successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const updateBudgetDto: BudgetUpdate = {
        description: 'Updated Budget',
        monthlyIncome: 6000,
      };
      const mockUpdatedBudget = createMockBudgetDbEntity(updateBudgetDto);
      
      mockSupabaseMethods.single.mockResolvedValue({ data: mockUpdatedBudget, error: null });

      // Act
      const result = await service.update(budgetId, updateBudgetDto, mockUser, mockSupabaseClient);

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty('mappedToApi', true);
      expect(mockSupabaseMethods.from).toHaveBeenCalledWith('budgets');
      expect(mockSupabaseMethods.update).toHaveBeenCalled();
      expect(mockSupabaseMethods.eq).toHaveBeenCalledWith('id', budgetId);
      expect(mockSupabaseMethods.select).toHaveBeenCalled();
      expect(mockSupabaseMethods.single).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent budget', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = 'non-existent-id';
      const updateBudgetDto: BudgetUpdate = {
        description: 'Updated Budget',
      };
      const mockError = { message: 'No rows returned' };
      
      mockSupabaseMethods.single.mockResolvedValue({ data: null, error: mockError });

      // Act & Assert
      await expectErrorThrown(
        () => service.update(budgetId, updateBudgetDto, mockUser, mockSupabaseClient),
        NotFoundException,
        'Budget introuvable ou modification non autorisée'
      );
    });

    it('should handle unexpected errors during update', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      const updateBudgetDto: BudgetUpdate = {
        description: 'Updated Budget',
      };
      
      mockSupabaseMethods.single.mockRejectedValue(new Error('Database connection lost'));

      // Act & Assert
      await expectErrorThrown(
        () => service.update(budgetId, updateBudgetDto, mockUser, mockSupabaseClient),
        InternalServerErrorException,
        'Erreur interne du serveur'
      );
    });
  });

  describe('remove', () => {
    it('should delete budget successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      
      mockSupabaseMethods.delete.mockResolvedValue({ error: null });

      // Act
      const result = await service.remove(budgetId, mockUser, mockSupabaseClient);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Budget supprimé avec succès',
      });
      expect(mockSupabaseMethods.from).toHaveBeenCalledWith('budgets');
      expect(mockSupabaseMethods.delete).toHaveBeenCalled();
      expect(mockSupabaseMethods.eq).toHaveBeenCalledWith('id', budgetId);
    });

    it('should throw NotFoundException when deleting non-existent budget', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = 'non-existent-id';
      const mockError = { message: 'No rows affected' };
      
      mockSupabaseMethods.delete.mockResolvedValue({ error: mockError });

      // Act & Assert
      await expectErrorThrown(
        () => service.remove(budgetId, mockUser, mockSupabaseClient),
        NotFoundException,
        'Budget introuvable ou suppression non autorisée'
      );
    });

    it('should handle unexpected errors during deletion', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const budgetId = MOCK_BUDGET_ID;
      
      mockSupabaseMethods.delete.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expectErrorThrown(
        () => service.remove(budgetId, mockUser, mockSupabaseClient),
        InternalServerErrorException,
        'Erreur interne du serveur'
      );
    });
  });

  describe('createFromOnboarding', () => {
    it('should create budget from onboarding data successfully', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const onboardingData: BudgetCreateFromOnboarding = {
        month: 11,
        year: 2024,
        description: 'Onboarding Budget',
        monthlyIncome: 5000,
        housingCosts: 1500,
        healthInsurance: 400,
        leasingCredit: 800,
        phonePlan: 50,
        transportCosts: 200,
      };
      const mockBudget = createMockBudgetDbEntity();
      
      mockSupabaseMethods.rpc.mockResolvedValue({ 
        data: { budget: mockBudget }, 
        error: null 
      });

      // Act
      const result = await service.createFromOnboarding(onboardingData, mockUser, mockSupabaseClient);

      // Assert
      expectSuccessResponse(result);
      expect(result.data).toHaveProperty('mappedToApi', true);
      expect(mockSupabaseMethods.rpc).toHaveBeenCalledWith(
        'create_budget_from_onboarding_with_transactions',
        {
          p_user_id: mockUser.id,
          p_month: onboardingData.month,
          p_year: onboardingData.year,
          p_description: onboardingData.description,
          p_monthly_income: onboardingData.monthlyIncome,
          p_housing_costs: onboardingData.housingCosts,
          p_health_insurance: onboardingData.healthInsurance,
          p_leasing_credit: onboardingData.leasingCredit,
          p_phone_plan: onboardingData.phonePlan,
          p_transport_costs: onboardingData.transportCosts,
        }
      );
    });

    it('should throw BadRequestException when RPC fails', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const onboardingData: BudgetCreateFromOnboarding = {
        month: 11,
        year: 2024,
        description: 'Onboarding Budget',
        monthlyIncome: 5000,
        housingCosts: 1500,
        healthInsurance: 400,
        leasingCredit: 800,
        phonePlan: 50,
        transportCosts: 200,
      };
      const mockError = { message: 'RPC execution failed' };
      
      mockSupabaseMethods.rpc.mockResolvedValue({ data: null, error: mockError });

      // Act & Assert
      await expectErrorThrown(
        () => service.createFromOnboarding(onboardingData, mockUser, mockSupabaseClient),
        BadRequestException,
        'Erreur lors de la création du budget et des transactions'
      );
    });

    it('should throw InternalServerErrorException when no budget returned', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const onboardingData: BudgetCreateFromOnboarding = {
        month: 11,
        year: 2024,
        description: 'Onboarding Budget',
        monthlyIncome: 5000,
        housingCosts: 1500,
        healthInsurance: 400,
        leasingCredit: 800,
        phonePlan: 50,
        transportCosts: 200,
      };
      
      mockSupabaseMethods.rpc.mockResolvedValue({ 
        data: { budget: null }, 
        error: null 
      });

      // Act & Assert
      await expectErrorThrown(
        () => service.createFromOnboarding(onboardingData, mockUser, mockSupabaseClient),
        InternalServerErrorException,
        'Aucun budget retourné par la fonction'
      );
    });

    it('should handle unexpected errors during onboarding creation', async () => {
      // Arrange
      const mockUser = createMockAuthenticatedUser();
      const onboardingData: BudgetCreateFromOnboarding = {
        month: 11,
        year: 2024,
        description: 'Onboarding Budget',
        monthlyIncome: 5000,
        housingCosts: 1500,
        healthInsurance: 400,
        leasingCredit: 800,
        phonePlan: 50,
        transportCosts: 200,
      };
      
      mockSupabaseMethods.rpc.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expectErrorThrown(
        () => service.createFromOnboarding(onboardingData, mockUser, mockSupabaseClient),
        InternalServerErrorException,
        'Erreur interne du serveur'
      );
    });
  });
});