import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  VersioningType,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
import { PinoLogger } from 'nestjs-pino';
import {
  budgetDeletionImpactResponseSchema,
  type BudgetDeletionImpact,
} from 'pulpe-shared';
import { BudgetController } from './budget.controller';
import { RemoveBudgetUseCase } from '../../application/remove-budget.use-case';
import { HasBudgetsUseCase } from '../../application/has-budgets.use-case';
import { FindAllBudgetsUseCase } from '../../application/find-all-budgets.use-case';
import { FindBudgetUseCase } from '../../application/find-budget.use-case';
import { FindBudgetWithDetailsUseCase } from '../../application/find-budget-with-details.use-case';
import { CreateBudgetUseCase } from '../../application/create-budget.use-case';
import { UpdateBudgetUseCase } from '../../application/update-budget.use-case';
import { GenerateBudgetsUseCase } from '../../application/generate-budgets.use-case';
import { ExportAllBudgetsUseCase } from '../../application/export-all-budgets.use-case';
import { BudgetMapper } from '../mappers/budget.mapper';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { AuthGuard } from '@common/guards/auth.guard';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

const BUDGET_ID = '123e4567-e89b-12d3-a456-426614174000';
const MOCK_USER_ID = 'user-http-test';

const impact: BudgetDeletionImpact = {
  forecastCount: 4,
  movementCount: 2,
  links: {
    spreadForecasts: 1,
    savingsGoalForecasts: 0,
    savingsWithdrawalForecasts: 0,
    savingsWithdrawalMovements: 0,
  },
};

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: MOCK_USER_ID,
      email: 'http-test@test.local',
      accessToken: 'mock-token',
      clientKey: Buffer.alloc(32, 0xab),
    };
    req.supabase = {};
    return true;
  }
}

const noop = () => {};
const mockLogger = {
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
  setContext: noop,
} as unknown as PinoLogger;

const removeBudget = {
  impact: mock(() => Promise.resolve(impact)),
  execute: mock(() => Promise.resolve(impact)),
};

let app: INestApplication;

beforeAll(async () => {
  const unused = { useValue: {} };
  const moduleRef = await Test.createTestingModule({
    controllers: [BudgetController],
    providers: [
      { provide: RemoveBudgetUseCase, useValue: removeBudget },
      { provide: HasBudgetsUseCase, ...unused },
      { provide: FindAllBudgetsUseCase, ...unused },
      { provide: FindBudgetUseCase, ...unused },
      { provide: FindBudgetWithDetailsUseCase, ...unused },
      { provide: CreateBudgetUseCase, ...unused },
      { provide: UpdateBudgetUseCase, ...unused },
      { provide: GenerateBudgetsUseCase, ...unused },
      { provide: ExportAllBudgetsUseCase, ...unused },
      { provide: BudgetMapper, ...unused },
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      {
        provide: APP_FILTER,
        useFactory: () => new GlobalExceptionFilter(mockLogger),
      },
      { provide: PinoLogger, useValue: mockLogger },
      Reflector,
    ],
  })
    .overrideGuard(AuthGuard)
    .useClass(MockAuthGuard)
    .compile();

  app = moduleRef.createNestApplication();
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('Budget deletion HTTP surface', () => {
  describe('GET /api/v1/budgets/:id/deletion-impact', () => {
    it('returns the impact wrapped as a shared success response', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/budgets/${BUDGET_ID}/deletion-impact`)
        .expect(200);

      expect(budgetDeletionImpactResponseSchema.parse(res.body)).toEqual({
        success: true,
        data: impact,
      });
      expect(removeBudget.impact).toHaveBeenCalledWith(
        BUDGET_ID,
        expect.objectContaining({ id: MOCK_USER_ID }),
      );
    });

    it('answers 409 with the business code for a current or past month', async () => {
      removeBudget.impact.mockImplementationOnce(() =>
        Promise.reject(
          new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_DELETABLE),
        ),
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/budgets/${BUDGET_ID}/deletion-impact`)
        .expect(409);

      expect(res.body.code).toBe('ERR_BUDGET_NOT_DELETABLE');
    });

    it('answers 400 for a malformed id', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/budgets/not-a-uuid/deletion-impact')
        .expect(400);
    });
  });

  describe('DELETE /api/v1/budgets/:id', () => {
    it.each([
      ['?confirmLinks=true', true],
      ['?confirmLinks=false', false],
      ['', false],
    ])(
      'reaches the use case with confirmLinks for "%s"',
      async (query, expected) => {
        removeBudget.execute.mockClear();

        const res = await request(app.getHttpServer())
          .delete(`/api/v1/budgets/${BUDGET_ID}${query}`)
          .expect(200);

        expect(res.body).toEqual({
          success: true,
          message: 'Budget deleted successfully',
        });
        expect(removeBudget.execute).toHaveBeenCalledWith(
          BUDGET_ID,
          expect.objectContaining({ id: MOCK_USER_ID }),
          expected,
        );
      },
    );

    it.each(['?confirmLinks=yes', '?confirmLinks=1', '?other=true'])(
      'rejects the query "%s" with 400 and deletes nothing',
      async (query) => {
        removeBudget.execute.mockClear();

        const res = await request(app.getHttpServer())
          .delete(`/api/v1/budgets/${BUDGET_ID}${query}`)
          .expect(400);

        expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
        expect(removeBudget.execute).not.toHaveBeenCalled();
      },
    );

    it('answers 409 with the links in details when they are not confirmed', async () => {
      removeBudget.execute.mockImplementationOnce(() =>
        Promise.reject(
          new BusinessException(
            ERROR_DEFINITIONS.BUDGET_DELETION_LINKS_UNCONFIRMED,
            { links: impact.links },
          ),
        ),
      );

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/budgets/${BUDGET_ID}`)
        .expect(409);

      expect(res.body.code).toBe('ERR_BUDGET_DELETION_LINKS_UNCONFIRMED');
      expect(res.body.details).toEqual({ links: impact.links });
    });
  });
});
