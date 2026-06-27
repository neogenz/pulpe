import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { ResolveNextMonthBudgetUseCase } from './resolve-next-month-budget.use-case';
import { BUDGET_REPOSITORY } from '../domain/ports/budget-repository.port';
import type { Budget } from '../domain/budget.entity';

function budgetAt(month: number, year: number): Budget {
  return {
    id: 'budget-1',
    userId: 'user-1',
    month,
    year,
    description: 'Budget',
    endingBalance: null,
    templateId: 'tpl-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ResolveNextMonthBudgetUseCase', () => {
  let useCase: ResolveNextMonthBudgetUseCase;
  let mockRepo: {
    fetchBudgetById: ReturnType<typeof jest.fn>;
    fetchBudgetIdByPeriod: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      fetchBudgetById: jest.fn(),
      fetchBudgetIdByPeriod: jest.fn().mockResolvedValue('budget-next'),
    };

    const module = await Test.createTestingModule({
      providers: [
        ResolveNextMonthBudgetUseCase,
        { provide: BUDGET_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();

    useCase = module.get(ResolveNextMonthBudgetUseCase);
  });

  it('resolves the next calendar month within the same year', async () => {
    mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(6, 2026));

    const id = await useCase.findNextMonthBudgetId('budget-1', 'user-1');

    expect(mockRepo.fetchBudgetIdByPeriod).toHaveBeenCalledWith(7, 2026);
    expect(id).toBe('budget-next');
  });

  it('rolls over December to next January', async () => {
    mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(12, 2026));

    await useCase.findNextMonthBudgetId('budget-1', 'user-1');

    expect(mockRepo.fetchBudgetIdByPeriod).toHaveBeenCalledWith(1, 2027);
  });

  it('returns null when the next month has no budget', async () => {
    mockRepo.fetchBudgetById.mockResolvedValue(budgetAt(6, 2026));
    mockRepo.fetchBudgetIdByPeriod.mockResolvedValueOnce(null);

    const id = await useCase.findNextMonthBudgetId('budget-1', 'user-1');
    expect(id).toBeNull();
  });
});
