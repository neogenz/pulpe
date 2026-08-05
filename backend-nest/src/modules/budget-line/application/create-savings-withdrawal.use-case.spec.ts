import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import { CacheService } from '@modules/cache/cache.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BUDGET_PROVISIONING_PORT } from '@modules/budget/domain/ports/budget-provisioning.port';
import { BUDGET_PERIOD_LOOKUP_PORT } from '@modules/budget/domain/ports/budget-period-lookup.port';
import { BUDGET_TEMPLATE_REPOSITORY } from '@modules/budget-template/domain/ports/budget-template-repository.port';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLineSavingsWithdrawalCreate } from 'pulpe-shared';
import { CreateSavingsWithdrawalUseCase } from './create-savings-withdrawal.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { SavingsWithdrawalPairExistsError } from '../domain/savings-withdrawal-conflict.error';
import type {
  BudgetLine,
  BudgetLineCreateInput,
  SavingsWithdrawalPairInputs,
} from '../domain/budget-line.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const SOURCE_BUDGET_ID = 'budget-july';
const REPAYMENT_BUDGET_ID = 'b-8-2026';

const makeLine = (
  input: BudgetLineCreateInput,
  groupId: string,
  idx: number,
): BudgetLine => ({
  id: `line-${idx}`,
  budgetId: input.budgetId,
  templateLineId: null,
  savingsGoalId: null,
  spreadGroupId: null,
  savingsWithdrawalGroupId: groupId,
  sourceSavingsGoalId: null,
  sourceSavingsGoalName: null,
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
  tagIds: [],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
});

const makeDto = (
  overrides: Partial<BudgetLineSavingsWithdrawalCreate> = {},
): BudgetLineSavingsWithdrawalCreate => ({
  budgetId: SOURCE_BUDGET_ID,
  amount: 280,
  incomeName: 'Mon épargne',
  savingName: 'Remettre sur ton épargne',
  ...overrides,
});

describe('CreateSavingsWithdrawalUseCase', () => {
  let useCase: CreateSavingsWithdrawalUseCase;
  let captured: { groupId: string; inputs: SavingsWithdrawalPairInputs }[];
  // Simulates the partial-unique-index guard: a second insert with an
  // already-seen groupId rejects (like Postgres 23505), and the replay path
  // reads the pair back via findBySavingsWithdrawalGroupId — deterministic.
  let pairDb: Map<string, BudgetLine[]>;
  let mockRepo: {
    createSavingsWithdrawalPair: ReturnType<typeof jest.fn>;
    findBySavingsWithdrawalGroupId: ReturnType<typeof jest.fn>;
  };
  let mockProvisioning: { ensureBudgetsForPeriods: ReturnType<typeof jest.fn> };
  let mockPeriodLookup: { findNextMonthPeriod: ReturnType<typeof jest.fn> };
  let mockTemplateRepo: { findDefaultTemplateId: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    captured = [];
    pairDb = new Map();
    mockRepo = {
      createSavingsWithdrawalPair: jest.fn(
        (groupId: string, inputs: SavingsWithdrawalPairInputs) => {
          captured.push({ groupId, inputs });
          if (pairDb.has(groupId)) {
            return Promise.reject(
              new SavingsWithdrawalPairExistsError(groupId),
            );
          }
          const lines = [
            makeLine(inputs.income, groupId, 1),
            makeLine(inputs.saving, groupId, 2),
          ];
          pairDb.set(groupId, lines);
          return Promise.resolve(lines);
        },
      ),
      findBySavingsWithdrawalGroupId: jest.fn((groupId: string) =>
        Promise.resolve(pairDb.get(groupId) ?? []),
      ),
    };
    mockProvisioning = {
      ensureBudgetsForPeriods: jest.fn(
        (periods: { month: number; year: number }[]) =>
          Promise.resolve({
            budgetIdByPeriod: new Map(
              periods.map((p) => [`${p.month}/${p.year}`, REPAYMENT_BUDGET_ID]),
            ),
            createdBudgets: [],
            skippedMonths: [],
          }),
      ),
    };
    mockPeriodLookup = {
      findNextMonthPeriod: jest
        .fn()
        .mockResolvedValue({ month: 8, year: 2026 }),
    };
    mockTemplateRepo = {
      findDefaultTemplateId: jest.fn().mockResolvedValue('template-1'),
    };
    mockBudget = { recalculate: jest.fn().mockResolvedValue(undefined) };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        CreateSavingsWithdrawalUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: BUDGET_PROVISIONING_PORT, useValue: mockProvisioning },
        { provide: BUDGET_PERIOD_LOOKUP_PORT, useValue: mockPeriodLookup },
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockTemplateRepo },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${CreateSavingsWithdrawalUseCase.name}`,
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

    useCase = module.get(CreateSavingsWithdrawalUseCase);
  });

  it('should create the linked pair: income on M and one_off saving on M+1 with the same amount', async () => {
    const result = await useCase.execute(makeDto(), mockUser);

    expect(mockRepo.createSavingsWithdrawalPair).toHaveBeenCalledTimes(1);
    const { groupId, inputs } = captured[0];
    expect(groupId).toMatch(/[0-9a-f-]{36}/);
    expect(inputs.income).toMatchObject({
      budgetId: SOURCE_BUDGET_ID,
      kind: 'income',
      recurrence: 'one_off',
      amount: 280,
      name: 'Mon épargne',
    });
    expect(inputs.saving).toMatchObject({
      budgetId: REPAYMENT_BUDGET_ID,
      kind: 'saving',
      recurrence: 'one_off',
      amount: 280,
      name: 'Remettre sur ton épargne',
    });
    expect(result.incomeLine.kind).toBe('income');
    expect(result.savingLine.kind).toBe('saving');
    expect(result.groupId).toBe(groupId);
  });

  it('should provision M+1 from the period resolved off the source budget', async () => {
    await useCase.execute(makeDto(), mockUser);

    expect(mockPeriodLookup.findNextMonthPeriod).toHaveBeenCalledWith(
      SOURCE_BUDGET_ID,
      mockUser.id,
    );
    expect(mockProvisioning.ensureBudgetsForPeriods).toHaveBeenCalledWith(
      [{ month: 8, year: 2026 }],
      'template-1',
      mockUser.id,
    );
  });

  it('should recalculate both budgets and invalidate the cache once', async () => {
    await useCase.execute(makeDto(), mockUser);

    expect(mockBudget.recalculate).toHaveBeenCalledTimes(2);
    expect(mockBudget.recalculate).toHaveBeenCalledWith(SOURCE_BUDGET_ID);
    expect(mockBudget.recalculate).toHaveBeenCalledWith(REPAYMENT_BUDGET_ID);
    expect(mockCache.invalidateForUser).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should freeze the same FX quad on both lines', async () => {
    await useCase.execute(
      makeDto({
        amount: 264,
        originalAmount: 280,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.943,
      }),
      mockUser,
    );

    const { inputs } = captured[0];
    for (const side of [inputs.income, inputs.saving]) {
      expect(side.originalAmount).toBe(280);
      expect(side.originalCurrency).toBe('EUR');
      expect(side.targetCurrency).toBe('CHF');
      expect(side.exchangeRate).toBe(0.943);
    }
  });

  it('should fail with 422 and insert NOTHING when M+1 cannot be provisioned', async () => {
    mockTemplateRepo.findDefaultTemplateId.mockResolvedValue(null);
    mockProvisioning.ensureBudgetsForPeriods.mockResolvedValue({
      budgetIdByPeriod: new Map(),
      createdBudgets: [],
      skippedMonths: [{ month: 8, year: 2026 }],
    });

    try {
      await useCase.execute(makeDto(), mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(
        'ERR_SAVINGS_WITHDRAWAL_MONTH_UNPROVISIONABLE',
      );
    }
    expect(mockRepo.createSavingsWithdrawalPair).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should surface the auto-created M+1 budget in the result', async () => {
    const createdBudget = {
      id: REPAYMENT_BUDGET_ID,
      userId: mockUser.id,
      templateId: 'template-1',
      month: 8,
      year: 2026,
      description: 'Budget 8/2026',
      endingBalance: null,
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
    };
    mockProvisioning.ensureBudgetsForPeriods.mockResolvedValue({
      budgetIdByPeriod: new Map([['8/2026', REPAYMENT_BUDGET_ID]]),
      createdBudgets: [createdBudget],
      skippedMonths: [],
    });

    const result = await useCase.execute(makeDto(), mockUser);

    expect(result.createdBudget).toBe(createdBudget);
  });

  it('should expose a partial failure when recalculation fails after the pair committed', async () => {
    const recalcError = new Error('recalc boom');
    mockBudget.recalculate.mockRejectedValue(recalcError);

    try {
      await useCase.execute(makeDto(), mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      const businessError = error as BusinessException;
      expect(businessError.code).toBe(
        'ERR_SAVINGS_WITHDRAWAL_RECALCULATION_FAILED',
      );
      expect(businessError.loggingContext.partialFailure).toBe(true);
    }
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  describe('idempotency / replay', () => {
    const idempotencyKey = 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

    it('uses the client-supplied groupId as the savings withdrawal group key', async () => {
      await useCase.execute(makeDto({ groupId: idempotencyKey }), mockUser);

      expect(captured[0].groupId).toBe(idempotencyKey);
    });

    it('replays the same pair on retry instead of creating a second one', async () => {
      const first = await useCase.execute(
        makeDto({ groupId: idempotencyKey }),
        mockUser,
      );
      const second = await useCase.execute(
        makeDto({ groupId: idempotencyKey }),
        mockUser,
      );

      expect(second.groupId).toBe(idempotencyKey);
      expect(second.incomeLine.id).toBe(first.incomeLine.id);
      expect(second.savingLine.id).toBe(first.savingLine.id);
      expect(pairDb.size).toBe(1);
      expect(mockRepo.findBySavingsWithdrawalGroupId).toHaveBeenCalledTimes(1);
    });

    it('re-runs the idempotent recalculation on replay to heal a stale balance', async () => {
      await useCase.execute(makeDto({ groupId: idempotencyKey }), mockUser);
      mockBudget.recalculate.mockClear();

      await useCase.execute(makeDto({ groupId: idempotencyKey }), mockUser);

      expect(mockBudget.recalculate).toHaveBeenCalledTimes(2);
    });

    it('surfaces a conflict when the existing group is not a complete pair for the caller', async () => {
      mockRepo.createSavingsWithdrawalPair.mockRejectedValue(
        new SavingsWithdrawalPairExistsError(idempotencyKey),
      );
      mockRepo.findBySavingsWithdrawalGroupId.mockResolvedValue([]);

      await expect(
        useCase.execute(makeDto({ groupId: idempotencyKey }), mockUser),
      ).rejects.toMatchObject({ code: 'ERR_SAVINGS_WITHDRAWAL_CONFLICT' });
    });

    it('does not replay a dup-pair error when the client supplied no idempotency key', async () => {
      mockRepo.createSavingsWithdrawalPair.mockRejectedValue(
        new SavingsWithdrawalPairExistsError('server-generated'),
      );

      await expect(useCase.execute(makeDto(), mockUser)).rejects.toBeInstanceOf(
        BusinessException,
      );
      expect(mockRepo.findBySavingsWithdrawalGroupId).not.toHaveBeenCalled();
    });
  });
});
