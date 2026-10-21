import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  setSystemTime,
} from 'bun:test';
import { Test } from '@nestjs/testing';
import { RemoveBudgetUseCase } from './remove-budget.use-case';
import { BUDGET_REPOSITORY } from '../domain/ports/budget-repository.port';
import type { BudgetDeletionLinkRows } from '../domain/budget-deletion';
import type { Budget } from '../domain/budget.entity';
import { CacheService } from '@modules/cache/cache.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

// Zurich noon: the live period is October 2026 unless a pay day shifts it.
const TODAY = '2026-10-20T10:00:00Z';

const noLinks: BudgetDeletionLinkRows = {
  lines: [
    {
      id: 'line-1',
      spreadGroupId: null,
      savingsGoalId: null,
      savingsWithdrawalGroupId: null,
      sourceSavingsGoalId: null,
    },
  ],
  movements: [{ budgetLineId: null, sourceSavingsGoalId: null }],
};

const spreadLink: BudgetDeletionLinkRows = {
  lines: [
    {
      id: 'line-1',
      spreadGroupId: 'spread-1',
      savingsGoalId: null,
      savingsWithdrawalGroupId: null,
      sourceSavingsGoalId: null,
    },
  ],
  movements: [],
};

function budgetAt(month: number, year: number): Budget {
  return {
    id: 'budget-1',
    userId: 'user-1',
    templateId: 'template-1',
    month,
    year,
    description: 'Budget',
    endingBalance: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

async function businessError(
  run: () => Promise<unknown>,
): Promise<BusinessException> {
  try {
    await run();
  } catch (error) {
    if (error instanceof BusinessException) return error;
    throw error;
  }
  throw new Error('expected a BusinessException');
}

describe('RemoveBudgetUseCase', () => {
  let useCase: RemoveBudgetUseCase;
  let mockRepo: {
    fetchBudgetById: ReturnType<typeof jest.fn>;
    fetchDeletionLinkRows: ReturnType<typeof jest.fn>;
    deleteBudget: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockLogger: { info: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    setSystemTime(new Date(TODAY));
    mockRepo = {
      fetchBudgetById: jest.fn().mockResolvedValue(budgetAt(11, 2026)),
      fetchDeletionLinkRows: jest.fn().mockResolvedValue(noLinks),
      deleteBudget: jest.fn().mockResolvedValue(undefined),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockLogger = { info: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        RemoveBudgetUseCase,
        { provide: BUDGET_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${RemoveBudgetUseCase.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    useCase = module.get(RemoveBudgetUseCase);
  });

  afterEach(() => setSystemTime());

  describe('execute', () => {
    it('deletes a future month with no links and invalidates the cache', async () => {
      const impact = await useCase.execute('budget-1', user);

      expect(mockRepo.deleteBudget).toHaveBeenCalledTimes(1);
      expect(mockRepo.deleteBudget).toHaveBeenCalledWith('budget-1');
      expect(mockCache.invalidateForUser).toHaveBeenCalledWith('user-1');
      expect(impact.forecastCount).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetId: 'budget-1',
          operation: 'budget.remove',
          confirmLinks: false,
        }),
        'Budget deleted',
      );
    });

    it('deletes a linked future month when confirmLinks is true', async () => {
      mockRepo.fetchDeletionLinkRows.mockResolvedValue(spreadLink);

      const impact = await useCase.execute('budget-1', user, true);

      expect(mockRepo.deleteBudget).toHaveBeenCalledTimes(1);
      expect(mockCache.invalidateForUser).toHaveBeenCalledWith('user-1');
      expect(impact.links.spreadForecasts).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ confirmLinks: true }),
        'Budget deleted',
      );
    });

    it.each([
      ['absent', undefined],
      ['false', false],
    ])(
      'refuses a linked month when confirmLinks is %s, with the links in details',
      async (_label, confirmLinks) => {
        mockRepo.fetchDeletionLinkRows.mockResolvedValue(spreadLink);

        const error = await businessError(() =>
          useCase.execute('budget-1', user, confirmLinks),
        );

        expect(error.code).toBe(
          ERROR_DEFINITIONS.BUDGET_DELETION_LINKS_UNCONFIRMED.code,
        );
        expect(error.getStatus()).toBe(409);
        expect(error.details).toEqual({
          links: {
            spreadForecasts: 1,
            savingsGoalForecasts: 0,
            savingsWithdrawalForecasts: 0,
            savingsWithdrawalMovements: 0,
          },
        });
        expect(mockRepo.deleteBudget).not.toHaveBeenCalled();
        expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['the current month', 10, 2026],
      ['the previous month', 9, 2026],
      ['a month of last year', 12, 2025],
    ])('refuses %s', async (_label, month, year) => {
      mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(month, year));

      const error = await businessError(() =>
        useCase.execute('budget-1', user, true),
      );

      expect(error.code).toBe(ERROR_DEFINITIONS.BUDGET_NOT_DELETABLE.code);
      expect(error.getStatus()).toBe(409);
      expect(error.loggingContext).toEqual({
        operation: 'budget.remove',
        userId: 'user-1',
        entityId: 'budget-1',
      });
      expect(mockRepo.deleteBudget).not.toHaveBeenCalled();
      expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
    });

    it('allows January of next year while December is the live period', async () => {
      setSystemTime(new Date('2026-12-15T10:00:00Z'));
      mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(1, 2027));

      await useCase.execute('budget-1', user);

      expect(mockRepo.deleteBudget).toHaveBeenCalledTimes(1);
    });

    it('reads today in Europe/Zurich, where November starts at 23:00Z on Oct 31', async () => {
      setSystemTime(new Date('2026-10-31T23:30:00Z'));
      mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(11, 2026));

      const error = await businessError(() =>
        useCase.execute('budget-1', user),
      );

      expect(error.code).toBe(ERROR_DEFINITIONS.BUDGET_NOT_DELETABLE.code);
      expect(mockRepo.deleteBudget).not.toHaveBeenCalled();
    });

    describe('when the pay day shifts the live period', () => {
      // 2026-10-26 with pay day 25 is already in the November period
      // (25 Oct - 24 Nov); without a pay day it is still October.
      const afterPayDay = new Date('2026-10-26T10:00:00Z');
      const payDay25 = { ...user, payDayOfMonth: 25 };

      beforeEach(() => setSystemTime(afterPayDay));

      it('refuses November, which is live, and allows December', async () => {
        mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(11, 2026));
        const error = await businessError(() =>
          useCase.execute('budget-1', payDay25),
        );
        expect(error.code).toBe(ERROR_DEFINITIONS.BUDGET_NOT_DELETABLE.code);
        expect(mockRepo.deleteBudget).not.toHaveBeenCalled();

        mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(12, 2026));
        await useCase.execute('budget-1', payDay25);
        expect(mockRepo.deleteBudget).toHaveBeenCalledTimes(1);
      });

      it('allows the same November month for a calendar user', async () => {
        mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(11, 2026));

        await useCase.execute('budget-1', user);

        expect(mockRepo.deleteBudget).toHaveBeenCalledTimes(1);
      });
    });

    it('propagates the 404 of an unknown or foreign id without deleting', async () => {
      mockRepo.fetchBudgetById.mockRejectedValue(
        new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, {
          id: 'budget-1',
        }),
      );

      const error = await businessError(() =>
        useCase.execute('budget-1', user),
      );

      expect(error.code).toBe(ERROR_DEFINITIONS.BUDGET_NOT_FOUND.code);
      expect(error.getStatus()).toBe(404);
      expect(mockRepo.deleteBudget).not.toHaveBeenCalled();
    });
  });
});
