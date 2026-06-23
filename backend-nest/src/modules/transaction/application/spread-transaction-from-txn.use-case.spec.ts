import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import { CacheService } from '@modules/cache/cache.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BUDGET_PROVISIONING_PORT } from '@modules/budget/domain/ports/budget-provisioning.port';
import { BUDGET_TEMPLATE_REPOSITORY } from '@modules/budget-template/domain/ports/budget-template-repository.port';
import { CreateBudgetLineSpreadUseCase } from '@modules/budget-line/application/create-budget-line-spread.use-case';
import { BUDGET_LINE_REPOSITORY } from '@modules/budget-line/domain/ports/budget-line-repository.port';
import { BUDGET_LINE_SPREAD_PORT } from '@modules/budget-line/domain/ports/budget-line-spread.port';
import type {
  BudgetLine,
  BudgetLineCreateInput,
  SpreadDeleteSource,
} from '@modules/budget-line/domain/budget-line.entity';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TransactionSpreadFromTxnCreate } from 'pulpe-shared';
import { SpreadTransactionFromTxnUseCase } from './spread-transaction-from-txn.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import type { SpreadSourceTransaction } from '../domain/transaction.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const makeSource = (
  overrides: Partial<SpreadSourceTransaction> = {},
): SpreadSourceTransaction => ({
  id: 'txn-source',
  budgetId: 'b-1-2026',
  budgetLineId: null,
  month: 1,
  year: 2026,
  name: 'Canapé',
  amount: 800,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
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

const eightPeriods: TransactionSpreadFromTxnCreate['periods'] = Array.from(
  { length: 8 },
  (_, i) => ({ year: 2026, month: i + 1 }),
);

describe('SpreadTransactionFromTxnUseCase', () => {
  let useCase: SpreadTransactionFromTxnUseCase;
  let order: string[];
  let captured: {
    spreadGroupId: string;
    inputs: BudgetLineCreateInput[];
    source?: SpreadDeleteSource;
  }[];
  let mockTxnRepo: {
    findSpreadSource: ReturnType<typeof jest.fn>;
    delete: ReturnType<typeof jest.fn>;
  };
  let mockBudgetLineRepo: { createSpread: ReturnType<typeof jest.fn> };
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
    mockTxnRepo = {
      findSpreadSource: jest.fn().mockResolvedValue(makeSource()),
      delete: jest.fn(() => {
        order.push('delete');
        return Promise.resolve();
      }),
    };
    mockBudgetLineRepo = {
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
        SpreadTransactionFromTxnUseCase,
        CreateBudgetLineSpreadUseCase,
        {
          provide: BUDGET_LINE_SPREAD_PORT,
          useExisting: CreateBudgetLineSpreadUseCase,
        },
        { provide: TRANSACTION_REPOSITORY, useValue: mockTxnRepo },
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockBudgetLineRepo },
        { provide: BUDGET_PROVISIONING_PORT, useValue: mockProvisioning },
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockTemplateRepo },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        { provide: CacheService, useValue: mockCache },
        loggerProvider(SpreadTransactionFromTxnUseCase.name),
        loggerProvider(CreateBudgetLineSpreadUseCase.name),
      ],
    }).compile();

    useCase = module.get(SpreadTransactionFromTxnUseCase);
  });

  it('redistributes a free réel T=800 over N=8 into 8 one_off lines of 100 (Σ=800), réel deleted atomically inside the RPC', async () => {
    const result = await useCase.execute(
      'txn-source',
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
    // Defect 2: the réel delete is folded INTO the fan-out RPC (atomic) via the
    // source param — never a separate repo.delete (delete-then-fanout would risk
    // losing the actual if the fan-out failed).
    expect(captured[0].source).toEqual({
      type: 'transaction',
      id: 'txn-source',
    });
    expect(order).toEqual(['fanOut']);
    expect(mockTxnRepo.delete).not.toHaveBeenCalled();
  });

  it('rejects an allocated transaction (budgetLineId set) with TRANSACTION_NOT_SPREADABLE, no fan-out/delete', async () => {
    mockTxnRepo.findSpreadSource.mockResolvedValue(
      makeSource({ budgetLineId: 'envelope-1' }),
    );

    await expect(
      useCase.execute('txn-source', { periods: eightPeriods }, mockUser),
    ).rejects.toMatchObject({ code: 'ERR_TRANSACTION_NOT_SPREADABLE' });
    expect(mockBudgetLineRepo.createSpread).not.toHaveBeenCalled();
    expect(mockTxnRepo.delete).not.toHaveBeenCalled();
  });

  it('rejects an income transaction with TRANSACTION_NOT_SPREADABLE', async () => {
    mockTxnRepo.findSpreadSource.mockResolvedValue(
      makeSource({ kind: 'income' }),
    );

    await expect(
      useCase.execute('txn-source', { periods: eightPeriods }, mockUser),
    ).rejects.toMatchObject({ code: 'ERR_TRANSACTION_NOT_SPREADABLE' });
    expect(mockBudgetLineRepo.createSpread).not.toHaveBeenCalled();
    expect(mockTxnRepo.delete).not.toHaveBeenCalled();
  });

  it('recalculates the touched budgets + source budget and invalidates cache once', async () => {
    await useCase.execute(
      'txn-source',
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
    // The fan-out (incl. atomic réel delete) already committed; only the M0
    // recalc AFTER the fan-out throws. The persisted M0 ending_balance is then
    // inconsistent, so the error must be observable (partialFailure). The
    // in-fan-out recalcs (one per touched budget) must still succeed; only the
    // final post-fan-out M0 recalc fails — mirrors RemoveTransaction.
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
      await useCase.execute('txn-source', { periods: eightPeriods }, mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe('ERR_TRANSACTION_DELETE_FAILED');
      expect(businessError.cause).toBe(recalcError);
      expect(businessError.loggingContext.severity).toBe('critical');
      expect(businessError.loggingContext.partialFailure).toBe(true);
      expect(businessError.loggingContext.budgetId).toBe('b-1-2026');
      expect(businessError.loggingContext.operation).toBe(
        'transaction.spreadFromTxn.recalcAfterFanOut',
      );
    }

    // The fan-out folded in the atomic réel delete; the cache was invalidated
    // BEFORE the failing recalc, so it is not left holding a stale read.
    expect(captured[0].source).toEqual({
      type: 'transaction',
      id: 'txn-source',
    });
    expect(mockTxnRepo.delete).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('inherits the frozen FX rate on every tranche and preserves Σ originalAmount', async () => {
    mockTxnRepo.findSpreadSource.mockResolvedValue(
      makeSource({
        amount: 192,
        originalAmount: 200,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.96,
      }),
    );

    await useCase.execute(
      'txn-source',
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
    const originalCents = inputs.reduce(
      (sum, i) => sum + Math.round((i.originalAmount ?? 0) * 100),
      0,
    );
    expect(originalCents / 100).toBe(200);
  });

  it('propagates a not-found from findSpreadSource before any fan-out (IDOR boundary)', async () => {
    mockTxnRepo.findSpreadSource.mockRejectedValue(new Error('not found'));

    await expect(
      useCase.execute('txn-source', { periods: eightPeriods }, mockUser),
    ).rejects.toThrow();
    expect(mockBudgetLineRepo.createSpread).not.toHaveBeenCalled();
    expect(mockTxnRepo.delete).not.toHaveBeenCalled();
  });
});
