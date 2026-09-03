import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CacheService } from '@modules/cache/cache.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { BUDGET_REPOSITORY } from '../domain/ports/budget-repository.port';
import { BUDGET_RECALCULATION_PORT } from '../domain/ports/budget-recalculation.port';
import type { Budget } from '../domain/budget.entity';
import { GenerateBudgetsUseCase } from './generate-budgets.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const budgets: Budget[] = [
  {
    id: 'budget-1',
    userId: user.id,
    templateId: 'template-1',
    month: 12,
    year: 2026,
    description: 'Budget 12/2026',
    endingBalance: null,
    createdAt: '2026-12-01T00:00:00Z',
    updatedAt: '2026-12-01T00:00:00Z',
  },
  {
    id: 'budget-2',
    userId: user.id,
    templateId: 'template-1',
    month: 1,
    year: 2027,
    description: 'Budget 1/2027',
    endingBalance: null,
    createdAt: '2027-01-01T00:00:00Z',
    updatedAt: '2027-01-01T00:00:00Z',
  },
];

describe('GenerateBudgetsUseCase', () => {
  let useCase: GenerateBudgetsUseCase;
  let repo: {
    generateBudgetsFromTemplateAtomically: ReturnType<typeof jest.fn>;
    fetchBudgetById: ReturnType<typeof jest.fn>;
    deleteBudgetsByIds: ReturnType<typeof jest.fn>;
  };
  let recalculate: ReturnType<typeof jest.fn>;
  let invalidateForUser: ReturnType<typeof jest.fn>;
  let warn: ReturnType<typeof jest.fn>;

  beforeEach(async () => {
    repo = {
      generateBudgetsFromTemplateAtomically: jest.fn().mockResolvedValue({
        createdBudgetIds: ['budget-1', 'budget-2'],
        skippedMonths: [{ month: 2, year: 2027 }],
      }),
      fetchBudgetById: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(budgets.find((budget) => budget.id === id)),
        ),
      deleteBudgetsByIds: jest.fn().mockResolvedValue(true),
    };
    recalculate = jest.fn().mockResolvedValue(undefined);
    invalidateForUser = jest.fn().mockResolvedValue(undefined);
    warn = jest.fn();

    const module = await Test.createTestingModule({
      providers: [
        GenerateBudgetsUseCase,
        { provide: BUDGET_REPOSITORY, useValue: repo },
        {
          provide: BUDGET_RECALCULATION_PORT,
          useValue: { recalculate },
        },
        {
          provide: CacheService,
          useValue: { invalidateForUser },
        },
        {
          provide: `INFO_LOGGER:${GenerateBudgetsUseCase.name}`,
          useValue: { info: () => {}, warn },
        },
      ],
    }).compile();
    useCase = module.get(GenerateBudgetsUseCase);
  });

  it('generates once, recalculates chronologically and returns created and skipped periods', async () => {
    const recalculationOrder: string[] = [];
    recalculate.mockImplementation(async (id: string) => {
      recalculationOrder.push(id);
    });

    const result = await useCase.execute(
      {
        templateId: '11111111-1111-4111-8111-111111111111',
        startMonth: 12,
        startYear: 2026,
        count: 3,
      },
      user,
    );

    expect(repo.generateBudgetsFromTemplateAtomically).toHaveBeenCalledWith({
      userId: user.id,
      templateId: '11111111-1111-4111-8111-111111111111',
      startMonth: 12,
      startYear: 2026,
      count: 3,
    });
    expect(recalculationOrder).toEqual(['budget-1', 'budget-2']);
    expect(result).toEqual({
      budgets,
      skippedMonths: [{ month: 2, year: 2027 }],
    });
    expect(invalidateForUser).toHaveBeenCalledTimes(1);
  });

  it('deletes the whole created batch when an encrypted recalculation fails', async () => {
    const recalculationError = new Error('decrypt failed');
    recalculate
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(recalculationError);

    let caught: unknown;
    try {
      await useCase.execute(
        {
          templateId: '11111111-1111-4111-8111-111111111111',
          startMonth: 12,
          startYear: 2026,
          count: 2,
        },
        user,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      'ERR_BUDGET_GENERATE_FAILED',
    );
    expect((caught as BusinessException).cause).toBe(recalculationError);
    expect(repo.deleteBudgetsByIds).toHaveBeenCalledWith([
      'budget-1',
      'budget-2',
    ]);
    expect(repo.fetchBudgetById).not.toHaveBeenCalled();
    expect(invalidateForUser).toHaveBeenCalledWith(user.id);
  });

  it('rolls back before cache invalidation and preserves the recalculation error when both fail', async () => {
    const calls: string[] = [];
    const recalculationError = new Error('decrypt failed');
    const cacheError = new Error('cache unavailable');
    recalculate.mockRejectedValueOnce(recalculationError);
    repo.deleteBudgetsByIds.mockImplementationOnce(async () => {
      calls.push('rollback');
      return true;
    });
    invalidateForUser.mockImplementationOnce(async () => {
      calls.push('cache');
      throw cacheError;
    });

    let caught: unknown;
    try {
      await useCase.execute(
        {
          templateId: '11111111-1111-4111-8111-111111111111',
          startMonth: 12,
          startYear: 2026,
          count: 2,
        },
        user,
      );
    } catch (error) {
      caught = error;
    }

    expect(calls).toEqual(['rollback', 'cache']);
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).cause).toBe(recalculationError);
    expect((caught as BusinessException).details).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: cacheError,
        originalErrMessage: 'decrypt failed',
      }),
      'Cache invalidation failed after budget generation rollback',
    );
  });

  it('reports every created budget as orphaned when rollback fails', async () => {
    const recalculationError = new Error('decrypt failed');
    const rollbackError = new Error('database unavailable');
    recalculate.mockRejectedValueOnce(recalculationError);
    repo.deleteBudgetsByIds.mockRejectedValueOnce(rollbackError);

    let caught: unknown;
    try {
      await useCase.execute(
        {
          templateId: '11111111-1111-4111-8111-111111111111',
          startMonth: 12,
          startYear: 2026,
          count: 2,
        },
        user,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).cause).toBe(recalculationError);
    expect((caught as BusinessException).details).toEqual({
      orphanedBudgetIds: ['budget-1', 'budget-2'],
    });
    expect(invalidateForUser).toHaveBeenCalledWith(user.id);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: rollbackError,
        originalErrMessage: 'decrypt failed',
      }),
      'Rollback of created budgets failed; budgets remain orphaned',
    );
  });
});
