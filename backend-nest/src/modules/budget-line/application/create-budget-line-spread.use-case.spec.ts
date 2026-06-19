import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import { CacheService } from '@modules/cache/cache.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BUDGET_PROVISIONING_PORT } from '@modules/budget/domain/ports/budget-provisioning.port';
import { BUDGET_TEMPLATE_REPOSITORY } from '@modules/budget-template/domain/ports/budget-template-repository.port';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLineSpreadCreate } from 'pulpe-shared';
import { CreateBudgetLineSpreadUseCase } from './create-budget-line-spread.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import type {
  BudgetLine,
  BudgetLineCreateInput,
} from '../domain/budget-line.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const makeLine = (
  input: BudgetLineCreateInput,
  spreadGroupId: string,
  idx: number,
): BudgetLine => ({
  id: `line-${idx}`,
  budgetId: input.budgetId,
  templateLineId: null,
  savingsGoalId: input.savingsGoalId ?? null,
  spreadGroupId,
  name: input.name,
  amount: input.amount,
  originalAmount: input.originalAmount ?? null,
  originalCurrency: input.originalCurrency ?? null,
  targetCurrency: input.targetCurrency ?? null,
  exchangeRate: input.exchangeRate ?? null,
  kind: input.kind,
  recurrence: input.recurrence,
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const makeDto = (
  overrides: Partial<BudgetLineSpreadCreate> = {},
): BudgetLineSpreadCreate => ({
  name: 'Prime assurance',
  kind: 'expense',
  tranches: [
    { year: 2026, month: 1, amount: 100 },
    { year: 2026, month: 2, amount: 100 },
    { year: 2026, month: 3, amount: 100 },
  ],
  ...overrides,
});

describe('CreateBudgetLineSpreadUseCase', () => {
  let useCase: CreateBudgetLineSpreadUseCase;
  let captured: { spreadGroupId: string; inputs: BudgetLineCreateInput[] }[];
  let mockRepo: { createSpread: ReturnType<typeof jest.fn> };
  let mockProvisioning: {
    ensureBudgetsForPeriods: ReturnType<typeof jest.fn>;
  };
  let mockTemplateRepo: { findDefaultTemplateId: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };

  const mapAllPeriods = (
    periods: { month: number; year: number }[],
  ): Map<string, string> =>
    new Map(
      periods.map((p) => [`${p.month}/${p.year}`, `b-${p.month}-${p.year}`]),
    );

  beforeEach(async () => {
    captured = [];
    mockRepo = {
      createSpread: jest.fn(
        (spreadGroupId: string, inputs: BudgetLineCreateInput[]) => {
          captured.push({ spreadGroupId, inputs });
          return Promise.resolve(
            inputs.map((input, idx) => makeLine(input, spreadGroupId, idx)),
          );
        },
      ),
    };
    mockProvisioning = {
      ensureBudgetsForPeriods: jest.fn(
        (periods: { month: number; year: number }[]) =>
          Promise.resolve({
            budgetIdByPeriod: mapAllPeriods(periods),
            createdBudgets: [],
            skippedMonths: [],
          }),
      ),
    };
    mockTemplateRepo = {
      findDefaultTemplateId: jest.fn().mockResolvedValue('template-1'),
    };
    mockBudget = { recalculate: jest.fn().mockResolvedValue(undefined) };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        CreateBudgetLineSpreadUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: BUDGET_PROVISIONING_PORT, useValue: mockProvisioning },
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockTemplateRepo },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${CreateBudgetLineSpreadUseCase.name}`,
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

    useCase = module.get(CreateBudgetLineSpreadUseCase);
  });

  it('should fan out one one_off line per tranche sharing a single spread group', async () => {
    const result = await useCase.execute(makeDto(), mockUser);

    expect(result.lines).toHaveLength(3);
    expect(mockRepo.createSpread).toHaveBeenCalledTimes(1);
    const { spreadGroupId, inputs } = captured[0];
    expect(spreadGroupId).toMatch(/[0-9a-f-]{36}/);
    expect(inputs).toHaveLength(3);
    expect(inputs.every((i) => i.recurrence === 'one_off')).toBe(true);
    expect(inputs.every((i) => i.savingsGoalId === null)).toBe(true);
    expect(result.lines.every((l) => l.spreadGroupId === spreadGroupId)).toBe(
      true,
    );
  });

  it('should recalculate every touched budget once and invalidate cache once', async () => {
    await useCase.execute(makeDto(), mockUser);

    expect(mockBudget.recalculate).toHaveBeenCalledTimes(3);
    expect(mockCache.invalidateForUser).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should NOT redistribute amounts across deselected months', async () => {
    const dto = makeDto({
      tranches: [
        { year: 2026, month: 1, amount: 100 },
        { year: 2026, month: 2, amount: 100 },
        { year: 2026, month: 4, amount: 100 },
      ],
    });

    await useCase.execute(dto, mockUser);

    const { inputs } = captured[0];
    expect(inputs).toHaveLength(3);
    expect(inputs.every((i) => i.amount === 100)).toBe(true);
  });

  it('should skip months with no budget and no default template', async () => {
    mockTemplateRepo.findDefaultTemplateId.mockResolvedValue(null);
    mockProvisioning.ensureBudgetsForPeriods.mockResolvedValue({
      budgetIdByPeriod: new Map([['1/2026', 'b-1-2026']]),
      createdBudgets: [],
      skippedMonths: [{ month: 2, year: 2026 }],
    });

    const dto = makeDto({
      tranches: [
        { year: 2026, month: 1, amount: 100 },
        { year: 2026, month: 2, amount: 100 },
      ],
    });

    const result = await useCase.execute(dto, mockUser);

    expect(captured[0].inputs).toHaveLength(1);
    expect(captured[0].inputs[0].budgetId).toBe('b-1-2026');
    expect(result.skippedMonths).toEqual([{ month: 2, year: 2026 }]);
  });

  it('should give overlapping spreads distinct spread group ids', async () => {
    await useCase.execute(makeDto(), mockUser);
    await useCase.execute(makeDto(), mockUser);

    expect(captured[0].spreadGroupId).not.toBe(captured[1].spreadGroupId);
  });

  it('should freeze a single exchange rate across all tranches', async () => {
    const dto = makeDto({
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 0.96,
      tranches: [
        { year: 2026, month: 1, amount: 96, originalAmount: 100 },
        { year: 2026, month: 2, amount: 96, originalAmount: 100 },
      ],
    });

    await useCase.execute(dto, mockUser);

    const { inputs } = captured[0];
    expect(inputs.every((i) => i.exchangeRate === 0.96)).toBe(true);
    expect(inputs.every((i) => i.originalCurrency === 'EUR')).toBe(true);
    expect(inputs.every((i) => i.targetCurrency === 'CHF')).toBe(true);
  });

  it('should support kind=saving while forcing recurrence one_off', async () => {
    await useCase.execute(makeDto({ kind: 'saving' }), mockUser);

    const { inputs } = captured[0];
    expect(inputs.every((i) => i.kind === 'saving')).toBe(true);
    expect(inputs.every((i) => i.recurrence === 'one_off')).toBe(true);
  });

  it('should invalidate cache and rethrow when the fan-out fails', async () => {
    mockRepo.createSpread.mockRejectedValue(new Error('rpc boom'));

    await expect(useCase.execute(makeDto(), mockUser)).rejects.toThrow(
      BusinessException,
    );
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });
});
