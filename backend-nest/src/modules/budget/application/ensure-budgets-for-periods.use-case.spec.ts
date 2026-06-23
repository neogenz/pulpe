import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BUDGET_REPOSITORY } from '../domain/ports/budget-repository.port';
import { EnsureBudgetsForPeriodsUseCase } from './ensure-budgets-for-periods.use-case';
import type { Budget } from '../domain/budget.entity';

const makeBudget = (id: string, month: number, year: number): Budget => ({
  id,
  userId: 'user-1',
  templateId: 'tpl-1',
  month,
  year,
  description: `Budget ${month}/${year}`,
  endingBalance: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('EnsureBudgetsForPeriodsUseCase', () => {
  let useCase: EnsureBudgetsForPeriodsUseCase;
  let mockRepo: {
    getExistingPeriods: ReturnType<typeof jest.fn>;
    createBudgetFromTemplateRpc: ReturnType<typeof jest.fn>;
    fetchBudgetById: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      getExistingPeriods: jest
        .fn()
        .mockResolvedValue(new Map<string, string>()),
      createBudgetFromTemplateRpc: jest.fn(),
      fetchBudgetById: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        EnsureBudgetsForPeriodsUseCase,
        { provide: BUDGET_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${EnsureBudgetsForPeriodsUseCase.name}`,
          useValue: {
            error: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(EnsureBudgetsForPeriodsUseCase);
  });

  it('maps an existing period to its budget id without creating anything', async () => {
    mockRepo.getExistingPeriods.mockResolvedValue(
      new Map([['1/2026', 'existing-b']]),
    );

    const result = await useCase.ensureBudgetsForPeriods(
      [{ month: 1, year: 2026 }],
      'tpl-1',
      'user-1',
    );

    expect(result.budgetIdByPeriod.get('1/2026')).toBe('existing-b');
    expect(result.createdBudgets).toHaveLength(0);
    expect(mockRepo.createBudgetFromTemplateRpc).not.toHaveBeenCalled();
  });

  it('auto-creates a missing period from the default template', async () => {
    mockRepo.createBudgetFromTemplateRpc.mockResolvedValue({
      budget: { id: 'new-b' },
      budget_lines_created: 0,
      template_name: 'Default',
    });
    mockRepo.fetchBudgetById.mockResolvedValue(makeBudget('new-b', 9, 2026));

    const result = await useCase.ensureBudgetsForPeriods(
      [{ month: 9, year: 2026 }],
      'tpl-1',
      'user-1',
    );

    expect(mockRepo.createBudgetFromTemplateRpc).toHaveBeenCalledWith({
      p_user_id: 'user-1',
      p_template_id: 'tpl-1',
      p_month: 9,
      p_year: 2026,
      p_description: 'Budget 9/2026',
    });
    expect(result.budgetIdByPeriod.get('9/2026')).toBe('new-b');
    expect(result.createdBudgets).toHaveLength(1);
    expect(result.skippedMonths).toHaveLength(0);
  });

  it('skips a missing period when there is no default template', async () => {
    const result = await useCase.ensureBudgetsForPeriods(
      [{ month: 9, year: 2026 }],
      null,
      'user-1',
    );

    expect(result.skippedMonths).toEqual([{ month: 9, year: 2026 }]);
    expect(result.budgetIdByPeriod.size).toBe(0);
    expect(mockRepo.createBudgetFromTemplateRpc).not.toHaveBeenCalled();
  });

  it('returns an empty result without querying for an empty period list', async () => {
    const result = await useCase.ensureBudgetsForPeriods([], 'tpl-1', 'user-1');

    expect(result.budgetIdByPeriod.size).toBe(0);
    expect(result.createdBudgets).toHaveLength(0);
    expect(result.skippedMonths).toHaveLength(0);
    expect(mockRepo.getExistingPeriods).not.toHaveBeenCalled();
  });
});
