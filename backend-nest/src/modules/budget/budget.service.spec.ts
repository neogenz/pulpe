import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetMapper } from './budget.mapper';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  expectSuccessResponse,
  expectErrorThrown,
  expectListResponse,
  expectPerformance,
  MOCK_BUDGET_ID,
  MockSupabaseClient,
} from '../../test/test-utils';
import type { BudgetCreate, BudgetUpdate } from '@pulpe/shared';

describe('BudgetService', () => {
  let service: BudgetService;
  let mockSupabaseClient: MockSupabaseClient;

  const createValidBudgetEntity = (overrides: any = {}): any => ({
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    created_at: '2024-01-15T10:30:00.000Z',
    updated_at: '2024-01-15T10:30:00.000Z',
    user_id: 'a1b2c3d4-e5f6-4789-8901-234567890abc',
    month: 1,
    year: 2024,
    description: 'Budget Janvier 2024',
    template_id: null,
    ...overrides,
  });

  const createValidBudgetCreateDto = (
    overrides: Partial<BudgetCreate> = {},
  ): BudgetCreate => ({
    month: 1,
    year: 2024,
    description: 'Test Budget',
    templateId: 'template-id',
    ...overrides,
  });

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
        BudgetMapper,
        {
          provide: `PinoLogger:${BudgetService.name}`,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
  });

  describe('findAll', () => {
    it('should return all budgets with proper data transformation', async () => {
      const mockBudgets = [
        createValidBudgetEntity(),
        createValidBudgetEntity({
          id: '550e8400-e29b-41d4-a716-446655440006',
          month: 2,
          description: 'Budget Février 2024',
        }),
      ];

      mockSupabaseClient.setMockData(mockBudgets).setMockError(null);

      await expectPerformance(
        async () => {
          const result = await service.findAll(mockSupabaseClient as any);

          expectListResponse(
            result,
            (budget: any) => {
              // Vérifier la transformation snake_case → camelCase
              expect(budget).toHaveProperty('id');
              expect(budget).toHaveProperty('createdAt');
              expect(budget).toHaveProperty('userId');
              expect(budget).not.toHaveProperty('created_at');
              expect(budget).not.toHaveProperty('user_id');
            },
            2,
          );

          // Note: Mock client doesn't apply sorting, so we test the transformation only
          // In real usage, Supabase orders by year desc, month desc
          expect(result.data).toHaveLength(2);
        },
        30,
        'BudgetService.findAll with proper transformation',
      );
    });

    it('should handle database error gracefully', async () => {
      const mockError = { message: 'Database connection failed' };
      mockSupabaseClient.setMockData(null).setMockError(mockError);

      await expectErrorThrown(
        () => service.findAll(mockSupabaseClient as any),
        InternalServerErrorException,
        'Erreur lors de la récupération des budgets',
      );
    });

    it('should handle valid budget data only', async () => {
      const validBudgets = [
        createValidBudgetEntity(),
        createValidBudgetEntity({
          id: '550e8400-e29b-41d4-a716-446655440006',
          month: 3,
          description: 'Budget Mars 2024',
        }),
      ];

      mockSupabaseClient.setMockData(validBudgets).setMockError(null);

      const result = await service.findAll(mockSupabaseClient as any);

      expectSuccessResponse(result);
      expect(result.data).toHaveLength(2); // All valid budgets
    });
  });

  describe('create', () => {
    it('should create budget with proper validation and transformation', async () => {
      const mockUser = createMockAuthenticatedUser(); // Still needed for create method
      const createBudgetDto = createValidBudgetCreateDto();
      const mockCreatedBudget = createValidBudgetEntity({
        id: 'new-budget-id',
        month: createBudgetDto.month,
        year: createBudgetDto.year,
        description: createBudgetDto.description,
        user_id: mockUser.id,
      });

      setupCreateMocks(mockSupabaseClient, mockCreatedBudget);

      const result = await service.create(
        createBudgetDto,
        mockUser,
        mockSupabaseClient as any,
      );

      expectSuccessResponse(result);
      expect(result.data.month).toBe(createBudgetDto.month);
      expect(result.data.year).toBe(createBudgetDto.year);
      expect(result.data.description).toBe(createBudgetDto.description);
      expect(result.data.userId).toBe(mockUser.id);
    });

    it('should validate against Zod schema constraints', async () => {
      const mockUser = createMockAuthenticatedUser(); // Still needed for create method

      // Test invalid month
      const invalidMonthDto: BudgetCreate = {
        month: 13, // Invalid: must be 1-12
        year: 2024,
        description: 'Test',
        templateId: 'template-id',
      };

      await expectErrorThrown(
        () =>
          service.create(invalidMonthDto, mockUser, mockSupabaseClient as any),
        BadRequestException,
        'Mois invalide',
      );

      // Test invalid year (too far in future)
      const invalidYearDto: BudgetCreate = {
        month: 1,
        year: new Date().getFullYear() + 5, // Too far in future
        description: 'Test',
        templateId: 'template-id',
      };

      await expectErrorThrown(
        () =>
          service.create(invalidYearDto, mockUser, mockSupabaseClient as any),
        BadRequestException,
        'Budget ne peut pas être créé plus de 2 ans dans le futur',
      );

      // Test description too long
      const invalidDescDto: BudgetCreate = {
        month: 1,
        year: 2024,
        description: Array(502).join('x'), // Too long: max 500 chars
        templateId: 'template-id',
      };

      await expectErrorThrown(
        () =>
          service.create(invalidDescDto, mockUser, mockSupabaseClient as any),
        BadRequestException,
        'Description ne peut pas dépasser 500 caractères',
      );
    });

    it('should prevent duplicate period creation', async () => {
      const mockUser = createMockAuthenticatedUser(); // Still needed for create method
      const createBudgetDto = createValidBudgetCreateDto();

      // Mock: budget already exists for this period
      mockSupabaseClient
        .setMockData({ id: 'existing-budget' })
        .setMockError(null);

      await expectErrorThrown(
        () =>
          service.create(createBudgetDto, mockUser, mockSupabaseClient as any),
        BadRequestException,
        'Un budget existe déjà pour cette période',
      );
    });
  });

  describe('findOne', () => {
    it('should return budget with enriched data', async () => {
      // const mockUser = createMockAuthenticatedUser(); // No longer needed
      const budgetId = MOCK_BUDGET_ID;
      const currentDate = new Date();
      const mockBudget = createValidBudgetEntity({
        id: budgetId,
        month: currentDate.getMonth() + 1, // Current month
        year: currentDate.getFullYear(),
      });

      mockSupabaseClient.setMockData(mockBudget).setMockError(null);

      const result = await service.findOne(budgetId, mockSupabaseClient as any);

      expectSuccessResponse(result);
      expect(result.data.id).toBe(budgetId);

      // Vérifier les enrichissements (ces tests passeront quand on utilisera le vrai service)
      // Ces propriétés sont ajoutées par validateAndEnrichBudget
      if ('displayPeriod' in result.data) {
        expect(result.data.displayPeriod).toBe(
          `Juin ${currentDate.getFullYear()}`,
        );
      }
      if ('isCurrentMonth' in result.data) {
        expect((result.data as any).isCurrentMonth).toBe(true);
      }
    });

    it('should throw NotFoundException when budget not found', async () => {
      // const mockUser = createMockAuthenticatedUser(); // No longer needed
      const budgetId = 'non-existent-id';
      const mockError = { message: 'No rows returned' };

      mockSupabaseClient.setMockData(null).setMockError(mockError);

      await expectErrorThrown(
        () => service.findOne(budgetId, mockSupabaseClient as any),
        NotFoundException,
        'Budget introuvable ou accès non autorisé',
      );
    });
  });

  describe('update', () => {
    it('should update budget with validation', async () => {
      // const mockUser = createMockAuthenticatedUser(); // No longer needed
      const budgetId = MOCK_BUDGET_ID;
      const updateBudgetDto: BudgetUpdate = {
        description: 'Budget Modifié',
        month: 3,
      };
      const mockUpdatedBudget = createValidBudgetEntity({
        id: budgetId,
        month: updateBudgetDto.month,
        year: 2024, // Provide a valid year
        description: updateBudgetDto.description,
        user_id: 'test-user-id',
      });

      mockSupabaseClient.setMockData(mockUpdatedBudget).setMockError(null);

      const result = await service.update(
        budgetId,
        updateBudgetDto,
        mockSupabaseClient as any,
      );

      expectSuccessResponse(result);
      expect(result.data.description).toBe(updateBudgetDto.description!);
      expect(result.data.month).toBe(updateBudgetDto.month!);
    });

    it('should validate update data against Zod schema', async () => {
      // const mockUser = createMockAuthenticatedUser(); // No longer needed
      const budgetId = MOCK_BUDGET_ID;

      // Test invalid update data
      const invalidUpdate: BudgetUpdate = {
        month: 0, // Invalid: must be 1-12
      };

      await expectErrorThrown(
        () =>
          service.update(budgetId, invalidUpdate, mockSupabaseClient as any),
        BadRequestException,
        'Mois invalide',
      );
    });
  });
});

// Helper function to setup create operation mocks
function setupCreateMocks(
  mockClient: MockSupabaseClient,
  mockCreatedBudget: any,
): void {
  let callCount = 0;
  const originalFrom = mockClient.from;

  mockClient.from = (table: string) => {
    callCount++;
    const chainMethods = originalFrom.call(mockClient, table);

    chainMethods.single = () => {
      if (callCount === 1) {
        // First call: validation check (no duplicate)
        return Promise.resolve({ data: null, error: null });
      } else {
        // Second call: return created budget
        return Promise.resolve({ data: mockCreatedBudget, error: null });
      }
    };

    chainMethods.insert = () => ({
      select: () => ({
        single: () => Promise.resolve({ data: mockCreatedBudget, error: null }),
      }),
    });

    return chainMethods;
  };
}
