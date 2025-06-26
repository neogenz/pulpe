import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetMapper } from './budget.mapper';
import { AuthGuard } from '@common/guards/auth.guard';
import { ZodBodyPipe } from '@common/pipes/zod-validation.pipe';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  createMockBudgetDbEntity,
  createTestingModuleBuilder,
  MOCK_USER_ID,
  MOCK_BUDGET_ID,
} from '../../test/test-utils';
import type { BudgetCreate, BudgetUpdate, BudgetCreateFromOnboarding } from '@pulpe/shared';

describe('BudgetController Integration Tests', () => {
  let app: INestApplication;
  let budgetService: BudgetService;
  let mockAuthGuard: any;
  
  beforeEach(async () => {
    const { mockSupabaseService } = createTestingModuleBuilder();
    
    // Mock AuthGuard to bypass authentication
    mockAuthGuard = {
      canActivate: () => {
        return true;
      },
    };

    // Mock BudgetService
    const mockBudgetService = {
      findAll: async () => ({
        success: true,
        data: [createMockBudgetDbEntity()],
      }),
      create: async (dto: BudgetCreate) => ({
        success: true,
        data: createMockBudgetDbEntity({ ...dto }),
      }),
      findOne: async (id: string) => ({
        success: true,
        data: createMockBudgetDbEntity({ id }),
      }),
      update: async (id: string, dto: BudgetUpdate) => ({
        success: true,
        data: createMockBudgetDbEntity({ id, ...dto }),
      }),
      remove: async (id: string) => ({
        success: true,
        message: 'Budget supprimé avec succès',
      }),
      createFromOnboarding: async (dto: BudgetCreateFromOnboarding) => ({
        success: true,
        data: createMockBudgetDbEntity({ ...dto }),
      }),
    };

    const mockBudgetMapper = {
      toApiList: (data: any[]) => data,
      toApi: (data: any) => data,
      toDbCreate: (data: any) => data,
      toDbUpdate: (data: any) => data,
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BudgetController],
      providers: [
        {
          provide: BudgetService,
          useValue: mockBudgetService,
        },
        {
          provide: BudgetMapper,
          useValue: mockBudgetMapper,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    budgetService = moduleRef.get<BudgetService>(BudgetService);
    
    // Mock request user and supabase for integration tests
    app.use((req: any, res: any, next: any) => {
      req.user = createMockAuthenticatedUser();
      req.supabase = createMockSupabaseClient().client;
      next();
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /budgets', () => {
    it('should return all budgets for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/budgets')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /budgets', () => {
    it('should create a new budget successfully', async () => {
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: 'Test Budget',
        monthlyIncome: 5000,
      };

      const response = await request(app.getHttpServer())
        .post('/budgets')
        .send(createBudgetDto)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('description', 'Test Budget');
      expect(response.body.data).toHaveProperty('monthlyIncome', 5000);
    });

    it('should return 400 for invalid budget data', async () => {
      const invalidBudgetDto = {
        month: 13, // Invalid month
        year: 2024,
        description: 'Test Budget',
        monthlyIncome: -1000, // Invalid negative income
      };

      const response = await request(app.getHttpServer())
        .post('/budgets')
        .send(invalidBudgetDto)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /budgets/:id', () => {
    it('should return specific budget by ID', async () => {
      const budgetId = MOCK_BUDGET_ID;

      const response = await request(app.getHttpServer())
        .get(`/budgets/${budgetId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', budgetId);
    });

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'invalid-uuid';

      await request(app.getHttpServer())
        .get(`/budgets/${invalidId}`)
        .expect(400);
    });
  });

  describe('PUT /budgets/:id', () => {
    it('should update existing budget successfully', async () => {
      const budgetId = MOCK_BUDGET_ID;
      const updateBudgetDto: BudgetUpdate = {
        description: 'Updated Budget',
        monthlyIncome: 6000,
      };

      const response = await request(app.getHttpServer())
        .put(`/budgets/${budgetId}`)
        .send(updateBudgetDto)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('description', 'Updated Budget');
      expect(response.body.data).toHaveProperty('monthlyIncome', 6000);
    });

    it('should return 400 for invalid UUID in update', async () => {
      const invalidId = 'invalid-uuid';
      const updateBudgetDto: BudgetUpdate = {
        description: 'Updated Budget',
      };

      await request(app.getHttpServer())
        .put(`/budgets/${invalidId}`)
        .send(updateBudgetDto)
        .expect(400);
    });
  });

  describe('DELETE /budgets/:id', () => {
    it('should delete budget successfully', async () => {
      const budgetId = MOCK_BUDGET_ID;

      const response = await request(app.getHttpServer())
        .delete(`/budgets/${budgetId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Budget supprimé avec succès');
    });

    it('should return 400 for invalid UUID in deletion', async () => {
      const invalidId = 'invalid-uuid';

      await request(app.getHttpServer())
        .delete(`/budgets/${invalidId}`)
        .expect(400);
    });
  });

  describe('POST /budgets/from-onboarding', () => {
    it('should create budget from onboarding data successfully', async () => {
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

      const response = await request(app.getHttpServer())
        .post('/budgets/from-onboarding')
        .send(onboardingData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('description', 'Onboarding Budget');
      expect(response.body.data).toHaveProperty('monthlyIncome', 5000);
    });

    it('should return 400 for invalid onboarding data', async () => {
      const invalidOnboardingData = {
        month: 13, // Invalid month
        year: 2024,
        description: 'Invalid Budget',
        monthlyIncome: -1000, // Invalid negative income
        housingCosts: 'invalid', // Should be number
      };

      const response = await request(app.getHttpServer())
        .post('/budgets/from-onboarding')
        .send(invalidOnboardingData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for missing required onboarding fields', async () => {
      const incompleteOnboardingData = {
        month: 11,
        year: 2024,
        // Missing required fields like monthlyIncome, housingCosts, etc.
      };

      const response = await request(app.getHttpServer())
        .post('/budgets/from-onboarding')
        .send(incompleteOnboardingData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Content-Type validation', () => {
    it('should accept application/json content type', async () => {
      const createBudgetDto: BudgetCreate = {
        month: 11,
        year: 2024,
        description: 'Test Budget',
        monthlyIncome: 5000,
      };

      await request(app.getHttpServer())
        .post('/budgets')
        .set('Content-Type', 'application/json')
        .send(createBudgetDto)
        .expect(201);
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app.getHttpServer())
        .post('/budgets')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('Response headers', () => {
    it('should return proper response headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/budgets')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});