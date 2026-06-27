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
import { SpreadGroupAlreadyExistsError } from '../domain/spread-group-conflict.error';
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
  mode: 'perMonth',
  perMonthAmount: 100,
  months: [
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
    { year: 2026, month: 3 },
  ],
  ...overrides,
});

describe('CreateBudgetLineSpreadUseCase', () => {
  let useCase: CreateBudgetLineSpreadUseCase;
  let captured: { spreadGroupId: string; inputs: BudgetLineCreateInput[] }[];
  // Simulates the DB dup-group guard: a second createSpread with an already-seen
  // spreadGroupId rejects (like the RPC RAISEs), and the replay path reads its
  // lines back via findBudgetLinesBySpreadGroupId — fully deterministic, no timing.
  let spreadDb: Map<string, BudgetLine[]>;
  let mockRepo: {
    createSpread: ReturnType<typeof jest.fn>;
    findBudgetLinesBySpreadGroupId: ReturnType<typeof jest.fn>;
  };
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
    spreadDb = new Map();
    mockRepo = {
      createSpread: jest.fn(
        (spreadGroupId: string, inputs: BudgetLineCreateInput[]) => {
          captured.push({ spreadGroupId, inputs });
          if (spreadDb.has(spreadGroupId)) {
            return Promise.reject(
              new SpreadGroupAlreadyExistsError(spreadGroupId),
            );
          }
          const lines = inputs.map((input, idx) =>
            makeLine(input, spreadGroupId, idx),
          );
          spreadDb.set(spreadGroupId, lines);
          return Promise.resolve(lines);
        },
      ),
      findBudgetLinesBySpreadGroupId: jest.fn((spreadGroupId: string) =>
        Promise.resolve(spreadDb.get(spreadGroupId) ?? []),
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
      months: [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 4 },
      ],
    });

    await useCase.execute(dto, mockUser);

    const { inputs } = captured[0];
    expect(inputs).toHaveLength(3);
    expect(inputs.every((i) => i.amount === 100)).toBe(true);
    expect(inputs.some((i) => i.budgetId === 'b-3-2026')).toBe(false);
    expect(inputs.map((i) => i.budgetId)).toEqual([
      'b-1-2026',
      'b-2-2026',
      'b-4-2026',
    ]);
  });

  it('should skip months with no budget and no default template', async () => {
    mockTemplateRepo.findDefaultTemplateId.mockResolvedValue(null);
    mockProvisioning.ensureBudgetsForPeriods.mockResolvedValue({
      budgetIdByPeriod: new Map([['1/2026', 'b-1-2026']]),
      createdBudgets: [],
      skippedMonths: [{ month: 2, year: 2026 }],
    });

    const dto = makeDto({
      months: [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
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

  it('should freeze a single exchange rate and replicate the original amount across all tranches', async () => {
    const dto = makeDto({
      perMonthAmount: 96,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 0.96,
      perMonthOriginalAmount: 100,
      months: [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
      ],
    });

    await useCase.execute(dto, mockUser);

    const { inputs } = captured[0];
    // Every row carries the identical frozen FX quadruplet — this is what the
    // per-row DB `fx_metadata_coherent` CHECK requires across the spread group.
    expect(inputs.every((i) => i.originalAmount === 100)).toBe(true);
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

  it('should expose a partial failure when recalculation fails after the spread committed', async () => {
    const recalcError = new Error('recalculation failed');
    mockBudget.recalculate.mockRejectedValue(recalcError);

    try {
      await useCase.execute(makeDto(), mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe(
        'ERR_BUDGET_LINE_SPREAD_RECALCULATION_FAILED',
      );
      expect(businessError.cause).toBe(recalcError);
      expect(businessError.loggingContext.partialFailure).toBe(true);
      expect(businessError.loggingContext.affectedBudgetIds).toEqual([
        'b-1-2026',
        'b-2-2026',
        'b-3-2026',
      ]);
    }

    expect(mockRepo.createSpread).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  describe('total mode', () => {
    const makeTotalDto = (
      overrides: Partial<BudgetLineSpreadCreate> = {},
    ): BudgetLineSpreadCreate =>
      makeDto({ mode: 'total', perMonthAmount: undefined, ...overrides });

    it('should divide the typed total cents-preserving so the inserted amounts sum to it', async () => {
      const dto = makeTotalDto({
        totalAmount: 100,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
          { year: 2026, month: 3 },
        ],
      });

      await useCase.execute(dto, mockUser);

      const { inputs } = captured[0];
      expect(inputs.map((i) => i.amount)).toEqual([33.34, 33.33, 33.33]);
      const sum = inputs.reduce((acc, i) => acc + i.amount, 0);
      expect(Math.round(sum * 100) / 100).toBe(100);
    });

    it('should split the FX original total and freeze the same rate quadruplet on every row', async () => {
      const dto = makeTotalDto({
        totalAmount: 96,
        totalOriginalAmount: 100,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.96,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
          { year: 2026, month: 3 },
        ],
      });

      await useCase.execute(dto, mockUser);

      const { inputs } = captured[0];
      const sumOriginal = inputs.reduce(
        (acc, i) => acc + (i.originalAmount ?? 0),
        0,
      );
      expect(Math.round(sumOriginal * 100) / 100).toBe(100);
      expect(inputs.every((i) => i.exchangeRate === 0.96)).toBe(true);
      expect(inputs.every((i) => i.originalCurrency === 'EUR')).toBe(true);
      expect(inputs.every((i) => i.targetCurrency === 'CHF')).toBe(true);
    });

    it('should invalidate the cache once on success', async () => {
      await useCase.execute(makeTotalDto({ totalAmount: 100 }), mockUser);

      expect(mockCache.invalidateForUser).toHaveBeenCalledTimes(1);
      expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('should fail the whole op without inserting when any month is unprovisionable', async () => {
      mockProvisioning.ensureBudgetsForPeriods.mockResolvedValue({
        budgetIdByPeriod: new Map([['1/2026', 'b-1-2026']]),
        createdBudgets: [],
        skippedMonths: [{ month: 2, year: 2026 }],
      });

      const dto = makeTotalDto({
        totalAmount: 100,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
        ],
      });

      await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
        BusinessException,
      );
      expect(mockRepo.createSpread).not.toHaveBeenCalled();
      expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('reports every unprovisionable month, not just the first', async () => {
      mockProvisioning.ensureBudgetsForPeriods.mockResolvedValue({
        budgetIdByPeriod: new Map([['1/2026', 'b-1-2026']]),
        createdBudgets: [],
        skippedMonths: [
          { month: 2, year: 2026 },
          { month: 3, year: 2026 },
        ],
      });

      const dto = makeTotalDto({
        totalAmount: 100,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
          { year: 2026, month: 3 },
        ],
      });

      try {
        await useCase.execute(dto, mockUser);
        throw new Error('Expected execute to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).details?.months).toEqual([
          { month: 2, year: 2026 },
          { month: 3, year: 2026 },
        ]);
      }
    });
  });

  describe('idempotency / replay', () => {
    const idempotencyKey = 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

    it('uses the client-supplied spreadGroupId as the spread group key', async () => {
      await useCase.execute(
        makeDto({ spreadGroupId: idempotencyKey }),
        mockUser,
      );

      expect(captured[0].spreadGroupId).toBe(idempotencyKey);
    });

    it('replays the same group on retry instead of creating a second one', async () => {
      const first = await useCase.execute(
        makeDto({ spreadGroupId: idempotencyKey }),
        mockUser,
      );
      const second = await useCase.execute(
        makeDto({ spreadGroupId: idempotencyKey }),
        mockUser,
      );

      expect(second.spreadGroupId).toBe(idempotencyKey);
      expect(second.lines.map((l) => l.id)).toEqual(
        first.lines.map((l) => l.id),
      );
      // The retry's createSpread tripped the dup-group guard; the replay then
      // read the existing lines back — no second group was created.
      expect(mockRepo.createSpread).toHaveBeenCalledTimes(2);
      expect(mockRepo.findBudgetLinesBySpreadGroupId).toHaveBeenCalledTimes(1);
      expect(spreadDb.size).toBe(1);
      expect(spreadDb.get(idempotencyKey)).toHaveLength(3);
    });

    it('re-runs the idempotent recalculation on replay to heal a stale balance', async () => {
      await useCase.execute(
        makeDto({ spreadGroupId: idempotencyKey }),
        mockUser,
      );
      mockBudget.recalculate.mockClear();

      await useCase.execute(
        makeDto({ spreadGroupId: idempotencyKey }),
        mockUser,
      );

      expect(mockBudget.recalculate).toHaveBeenCalledTimes(3);
    });

    it('heals the bug: first attempt commits but recalc throws, retry then succeeds without duplicating', async () => {
      // Attempt 1: createSpread commits the group, then recalc throws → 500.
      mockBudget.recalculate.mockRejectedValueOnce(new Error('recalc boom'));

      await expect(
        useCase.execute(makeDto({ spreadGroupId: idempotencyKey }), mockUser),
      ).rejects.toBeInstanceOf(BusinessException);
      // The lines committed despite the failed recalc (orphaned, group present).
      expect(spreadDb.get(idempotencyKey)).toHaveLength(3);

      // Retry with the SAME key: dup-group guard → replay, recalc now succeeds.
      const result = await useCase.execute(
        makeDto({ spreadGroupId: idempotencyKey }),
        mockUser,
      );

      expect(result.spreadGroupId).toBe(idempotencyKey);
      expect(result.lines).toHaveLength(3);
      expect(mockRepo.createSpread).toHaveBeenCalledTimes(2);
      expect(spreadDb.size).toBe(1);
    });

    it('surfaces a conflict (no fabricated success) when the existing group is not the caller’s', async () => {
      // Group exists at the DB level (guard fires) but RLS hides its rows from
      // this caller → the replay fetch is empty → must NOT pretend success.
      mockRepo.createSpread.mockRejectedValue(
        new SpreadGroupAlreadyExistsError(idempotencyKey),
      );
      mockRepo.findBudgetLinesBySpreadGroupId.mockResolvedValue([]);

      await expect(
        useCase.execute(makeDto({ spreadGroupId: idempotencyKey }), mockUser),
      ).rejects.toMatchObject({ code: 'ERR_BUDGET_LINE_ALREADY_SPREAD' });
    });

    it('does not replay a dup-group error when the client supplied no idempotency key', async () => {
      mockRepo.createSpread.mockRejectedValue(
        new SpreadGroupAlreadyExistsError('server-generated'),
      );

      await expect(useCase.execute(makeDto(), mockUser)).rejects.toBeInstanceOf(
        BusinessException,
      );
      expect(mockRepo.findBudgetLinesBySpreadGroupId).not.toHaveBeenCalled();
    });
  });
});
