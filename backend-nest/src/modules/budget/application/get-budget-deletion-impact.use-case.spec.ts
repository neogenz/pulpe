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
import { GetBudgetDeletionImpactUseCase } from './get-budget-deletion-impact.use-case';
import { BUDGET_REPOSITORY } from '../domain/ports/budget-repository.port';
import type { BudgetDeletionLinkRows } from '../domain/budget-deletion';
import type { Budget } from '../domain/budget.entity';
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

describe('GetBudgetDeletionImpactUseCase', () => {
  let useCase: GetBudgetDeletionImpactUseCase;
  let mockRepo: {
    fetchBudgetById: ReturnType<typeof jest.fn>;
    fetchDeletionLinkRows: ReturnType<typeof jest.fn>;
    deleteBudget: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    setSystemTime(new Date(TODAY));
    mockRepo = {
      fetchBudgetById: jest.fn().mockResolvedValue(budgetAt(11, 2026)),
      fetchDeletionLinkRows: jest.fn().mockResolvedValue(noLinks),
      deleteBudget: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetBudgetDeletionImpactUseCase,
        { provide: BUDGET_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();

    useCase = module.get(GetBudgetDeletionImpactUseCase);
  });

  afterEach(() => setSystemTime());

  it('returns the counts of a future month with no links', async () => {
    const impact = await useCase.execute('budget-1', user);

    expect(mockRepo.fetchBudgetById).toHaveBeenCalledWith('budget-1', 'user-1');
    expect(mockRepo.fetchDeletionLinkRows).toHaveBeenCalledWith('budget-1');
    expect(impact).toEqual({
      forecastCount: 1,
      movementCount: 1,
      links: {
        spreadForecasts: 0,
        savingsGoalForecasts: 0,
        savingsWithdrawalForecasts: 0,
        savingsWithdrawalMovements: 0,
      },
    });
    expect(mockRepo.deleteBudget).not.toHaveBeenCalled();
  });

  it('refuses the current month without reading its links', async () => {
    mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(10, 2026));

    const error = await businessError(() => useCase.execute('budget-1', user));

    expect(error.code).toBe(ERROR_DEFINITIONS.BUDGET_NOT_DELETABLE.code);
    expect(error.getStatus()).toBe(409);
    expect(error.loggingContext).toEqual({
      operation: 'budget.deletionImpact',
      userId: 'user-1',
      entityId: 'budget-1',
    });
    expect(mockRepo.fetchDeletionLinkRows).not.toHaveBeenCalled();
  });

  it('propagates the 404 of an unknown or foreign id', async () => {
    mockRepo.fetchBudgetById.mockRejectedValue(
      new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, {
        id: 'budget-1',
      }),
    );

    const error = await businessError(() => useCase.execute('budget-1', user));

    expect(error.code).toBe(ERROR_DEFINITIONS.BUDGET_NOT_FOUND.code);
    expect(error.getStatus()).toBe(404);
    expect(mockRepo.fetchDeletionLinkRows).not.toHaveBeenCalled();
  });
});
