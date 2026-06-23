import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import { CacheService } from '@modules/cache/cache.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BUDGET_PROVISIONING_PORT } from '@modules/budget/domain/ports/budget-provisioning.port';
import { BUDGET_TEMPLATE_REPOSITORY } from '@modules/budget-template/domain/ports/budget-template-repository.port';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLineSpreadFromLineCreate } from 'pulpe-shared';
import { SpreadBudgetLineFromLineUseCase } from './spread-budget-line-from-line.use-case';
import { CreateBudgetLineSpreadUseCase } from './create-budget-line-spread.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { BUDGET_LINE_SPREAD_PORT } from '../domain/ports/budget-line-spread.port';
import type {
  BudgetLine,
  BudgetLineCreateInput,
  SpreadDeleteSource,
  SpreadSourceLine,
} from '../domain/budget-line.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const makeSource = (
  overrides: Partial<SpreadSourceLine> = {},
): SpreadSourceLine => ({
  id: 'line-source',
  budgetId: 'b-1-2026',
  month: 1,
  year: 2026,
  name: 'Prime assurance',
  amount: 800,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'one_off',
  spreadGroupId: null,
  ...overrides,
});

const makeLine = (
  input: BudgetLineCreateInput,
  spreadGroupId: string,
  idx: number,
): BudgetLine => ({
  id: `line-${idx}`,
  budgetId: input.budgetId,
  templateLineId: null,
  savingsGoalId: null,
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

const eightPeriods: BudgetLineSpreadFromLineCreate['periods'] = Array.from(
  { length: 8 },
  (_, i) => ({ year: 2026, month: i + 1 }),
);

describe('SpreadBudgetLineFromLineUseCase', () => {
  let useCase: SpreadBudgetLineFromLineUseCase;
  let order: string[];
  let captured: {
    spreadGroupId: string;
    inputs: BudgetLineCreateInput[];
    source?: SpreadDeleteSource;
  }[];
  let mockRepo: {
    validateAccess: ReturnType<typeof jest.fn>;
    findSpreadSource: ReturnType<typeof jest.fn>;
    createSpread: ReturnType<typeof jest.fn>;
    delete: ReturnType<typeof jest.fn>;
  };
  let mockProvisioning: { ensureBudgetsForPeriods: ReturnType<typeof jest.fn> };
  let mockTemplateRepo: { findDefaultTemplateId: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };

  const mapPeriods = (
    periods: { month: number; year: number }[],
  ): Map<string, string> =>
    new Map(
      periods.map((p) => [`${p.month}/${p.year}`, `b-${p.month}-${p.year}`]),
    );

  beforeEach(async () => {
    order = [];
    captured = [];
    mockRepo = {
      validateAccess: jest.fn().mockResolvedValue(undefined),
      findSpreadSource: jest.fn().mockResolvedValue(makeSource()),
      createSpread: jest.fn(
        (
          spreadGroupId: string,
          inputs: BudgetLineCreateInput[],
          source?: SpreadDeleteSource,
        ) => {
          order.push('fanOut');
          captured.push({ spreadGroupId, inputs, source });
          return Promise.resolve(
            inputs.map((input, idx) => makeLine(input, spreadGroupId, idx)),
          );
        },
      ),
      delete: jest.fn(() => {
        order.push('delete');
        return Promise.resolve();
      }),
    };
    mockProvisioning = {
      ensureBudgetsForPeriods: jest.fn(
        (periods: { month: number; year: number }[]) =>
          Promise.resolve({
            budgetIdByPeriod: mapPeriods(periods),
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

    const loggerProvider = (name: string) => ({
      provide: `INFO_LOGGER:${name}`,
      useValue: {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {},
      },
    });

    const module = await Test.createTestingModule({
      providers: [
        SpreadBudgetLineFromLineUseCase,
        CreateBudgetLineSpreadUseCase,
        {
          provide: BUDGET_LINE_SPREAD_PORT,
          useExisting: CreateBudgetLineSpreadUseCase,
        },
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: BUDGET_PROVISIONING_PORT, useValue: mockProvisioning },
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockTemplateRepo },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        { provide: CacheService, useValue: mockCache },
        loggerProvider(SpreadBudgetLineFromLineUseCase.name),
        loggerProvider(CreateBudgetLineSpreadUseCase.name),
      ],
    }).compile();

    useCase = module.get(SpreadBudgetLineFromLineUseCase);
  });

  it('redistributes T=800 over N=8 into 8 lines of 100 (Σ=800), source deleted atomically inside the RPC', async () => {
    const result = await useCase.execute(
      'line-source',
      { periods: eightPeriods },
      mockUser,
    );

    expect(result.lines).toHaveLength(8);
    const amounts = captured[0].inputs.map((i) => i.amount);
    expect(amounts).toEqual([100, 100, 100, 100, 100, 100, 100, 100]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(800);
    expect(captured[0].inputs.every((i) => i.recurrence === 'one_off')).toBe(
      true,
    );
    // Defect 2: the source delete is folded INTO the fan-out RPC (atomic),
    // never a separate repo.delete call.
    expect(captured[0].source).toEqual({
      type: 'budget_line',
      id: 'line-source',
    });
    expect(order).toEqual(['fanOut']);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('invalidates the cache when the fan-out fails, so provisioned budgets are not left 30s-stale', async () => {
    mockRepo.createSpread.mockRejectedValueOnce(new Error('rpc boom'));

    await expect(
      useCase.execute('line-source', { periods: eightPeriods }, mockUser),
    ).rejects.toThrow();

    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
  });

  it('puts the remainder cent on the earliest month (M0 first)', async () => {
    mockRepo.findSpreadSource.mockResolvedValue(makeSource({ amount: 100 }));
    await useCase.execute(
      'line-source',
      {
        periods: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
          { year: 2026, month: 3 },
        ],
      },
      mockUser,
    );

    const amounts = captured[0].inputs.map((i) => i.amount);
    expect(amounts).toEqual([33.34, 33.33, 33.33]);
    const sumCents = amounts.reduce((acc, a) => acc + Math.round(a * 100), 0);
    expect(sumCents).toBe(10000);
  });

  it('rejects a fixed (recurring) source with BUDGET_LINE_NOT_SPREADABLE, no fan-out/delete', async () => {
    mockRepo.findSpreadSource.mockResolvedValue(
      makeSource({ recurrence: 'fixed' }),
    );

    await expect(
      useCase.execute('line-source', { periods: eightPeriods }, mockUser),
    ).rejects.toMatchObject({ code: 'ERR_BUDGET_LINE_NOT_SPREADABLE' });
    expect(mockRepo.createSpread).not.toHaveBeenCalled();
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('rejects an income source with BUDGET_LINE_NOT_SPREADABLE', async () => {
    mockRepo.findSpreadSource.mockResolvedValue(makeSource({ kind: 'income' }));

    await expect(
      useCase.execute('line-source', { periods: eightPeriods }, mockUser),
    ).rejects.toMatchObject({ code: 'ERR_BUDGET_LINE_NOT_SPREADABLE' });
    expect(mockRepo.createSpread).not.toHaveBeenCalled();
  });

  it('rejects an already-spread source with BUDGET_LINE_ALREADY_SPREAD', async () => {
    mockRepo.findSpreadSource.mockResolvedValue(
      makeSource({ spreadGroupId: 'existing-group' }),
    );

    await expect(
      useCase.execute('line-source', { periods: eightPeriods }, mockUser),
    ).rejects.toMatchObject({ code: 'ERR_BUDGET_LINE_ALREADY_SPREAD' });
    expect(mockRepo.createSpread).not.toHaveBeenCalled();
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('fails with UNPROVISIONABLE when a target month has no default template — nothing created, source intact', async () => {
    mockTemplateRepo.findDefaultTemplateId.mockResolvedValue(null);
    mockProvisioning.ensureBudgetsForPeriods.mockResolvedValue({
      budgetIdByPeriod: new Map([['1/2026', 'b-1-2026']]),
      createdBudgets: [],
      skippedMonths: [{ month: 2, year: 2026 }],
    });

    await expect(
      useCase.execute(
        'line-source',
        {
          periods: [
            { year: 2026, month: 1 },
            { year: 2026, month: 2 },
          ],
        },
        mockUser,
      ),
    ).rejects.toMatchObject({
      code: 'ERR_BUDGET_LINE_SPREAD_MONTH_UNPROVISIONABLE',
    });
    expect(mockRepo.createSpread).not.toHaveBeenCalled();
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('recalculates every touched budget including M0, invalidates cache once', async () => {
    await useCase.execute(
      'line-source',
      {
        periods: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
        ],
      },
      mockUser,
    );

    const recalculated = mockBudget.recalculate.mock.calls.map((c) => c[0]);
    expect(recalculated).toContain('b-1-2026');
    expect(recalculated).toContain('b-2-2026');
    expect(mockCache.invalidateForUser).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('throws a partialFailure BusinessException AND still invalidated the cache when the M0 recalc fails after a successful fan-out', async () => {
    // The fan-out (incl. atomic source delete) already committed; only the M0
    // recalc AFTER the fan-out throws. The persisted M0 ending_balance is then
    // inconsistent, so the error must be observable (partialFailure). The
    // in-fan-out recalcs (one per touched budget) must still succeed; only the
    // final post-fan-out M0 recalc fails — mirrors RemoveBudgetLine.
    const recalcError = new Error('transient recalc failure');
    const touchedCount = eightPeriods.length;
    let recalcCalls = 0;
    mockBudget.recalculate.mockImplementation(() => {
      recalcCalls += 1;
      return recalcCalls > touchedCount
        ? Promise.reject(recalcError)
        : Promise.resolve(undefined);
    });

    try {
      await useCase.execute('line-source', { periods: eightPeriods }, mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe('ERR_BUDGET_LINE_DELETE_FAILED');
      expect(businessError.cause).toBe(recalcError);
      expect(businessError.loggingContext.severity).toBe('critical');
      expect(businessError.loggingContext.partialFailure).toBe(true);
      expect(businessError.loggingContext.budgetId).toBe('b-1-2026');
      expect(businessError.loggingContext.operation).toBe(
        'budgetLine.spreadFromLine.recalcAfterFanOut',
      );
    }

    // The fan-out folded in the atomic source delete; the cache was invalidated
    // BEFORE the failing recalc, so it is not left holding a stale read.
    expect(captured[0].source).toEqual({
      type: 'budget_line',
      id: 'line-source',
    });
    expect(mockCache.invalidateForUser).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('inherits the frozen FX rate on every tranche and preserves Σ originalAmount', async () => {
    mockRepo.findSpreadSource.mockResolvedValue(
      makeSource({
        amount: 192,
        originalAmount: 200,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.96,
      }),
    );

    await useCase.execute(
      'line-source',
      {
        periods: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
        ],
      },
      mockUser,
    );

    const { inputs } = captured[0];
    expect(inputs.every((i) => i.exchangeRate === 0.96)).toBe(true);
    expect(inputs.every((i) => i.originalCurrency === 'EUR')).toBe(true);
    expect(inputs.every((i) => i.targetCurrency === 'CHF')).toBe(true);
    const originalCents = inputs.reduce(
      (sum, i) => sum + Math.round((i.originalAmount ?? 0) * 100),
      0,
    );
    expect(originalCents / 100).toBe(200);
  });

  it('rejects a period before the source month (forward-only)', async () => {
    mockRepo.findSpreadSource.mockResolvedValue(
      makeSource({ month: 3, year: 2026 }),
    );

    await expect(
      useCase.execute(
        'line-source',
        {
          periods: [
            { year: 2026, month: 2 },
            { year: 2026, month: 3 },
          ],
        },
        mockUser,
      ),
    ).rejects.toMatchObject({ code: 'ERR_BUDGET_LINE_VALIDATION_FAILED' });
    expect(mockRepo.createSpread).not.toHaveBeenCalled();
  });

  it('rejects a window that omits the source month', async () => {
    mockRepo.findSpreadSource.mockResolvedValue(
      makeSource({ month: 1, year: 2026 }),
    );

    await expect(
      useCase.execute(
        'line-source',
        {
          periods: [
            { year: 2026, month: 2 },
            { year: 2026, month: 3 },
          ],
        },
        mockUser,
      ),
    ).rejects.toMatchObject({ code: 'ERR_BUDGET_LINE_VALIDATION_FAILED' });
    expect(mockRepo.createSpread).not.toHaveBeenCalled();
  });

  it('validates access (IDOR) before fetching the source', async () => {
    mockRepo.validateAccess.mockRejectedValue(
      new BusinessException({
        code: 'ERR_BUDGET_LINE_NOT_FOUND',
        message: () => 'not found',
        httpStatus: 404,
      }),
    );

    await expect(
      useCase.execute('line-source', { periods: eightPeriods }, mockUser),
    ).rejects.toMatchObject({ code: 'ERR_BUDGET_LINE_NOT_FOUND' });
    expect(mockRepo.findSpreadSource).not.toHaveBeenCalled();
    expect(mockRepo.createSpread).not.toHaveBeenCalled();
  });
});
