import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { CreateBudgetLineUseCase } from './create-budget-line.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { USER_REPOSITORY } from '@modules/user/domain/ports/user-repository.port';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetLineCreate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLine } from '../domain/budget-line.entity';

const mockEntity: BudgetLine = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  budgetId: '123e4567-e89b-12d3-a456-426614174001',
  templateLineId: null,
  savingsGoalId: null,
  assetId: null,
  accountId: null,
  tagIds: [],
  spreadGroupId: null,
  savingsWithdrawalGroupId: null,
  sourceSavingsGoalId: null,
  sourceSavingsGoalName: null,
  name: 'Loyer',
  amount: 1200,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'fixed',
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('CreateBudgetLineUseCase', () => {
  let useCase: CreateBudgetLineUseCase;
  let mockRepo: { insert: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };
  let mockUserRepo: { findDefaultAccountId: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      insert: jest.fn().mockResolvedValue(mockEntity),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };
    mockBudget = {
      recalculate: jest.fn().mockResolvedValue(undefined),
    };
    mockUserRepo = { findDefaultAccountId: jest.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        CreateBudgetLineUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        {
          provide: `INFO_LOGGER:${CreateBudgetLineUseCase.name}`,
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

    useCase = module.get(CreateBudgetLineUseCase);
  });

  it('should create a budget line successfully', async () => {
    const dto: BudgetLineCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
    };

    const result = await useCase.execute(dto, mockUser);

    expect(result.id).toBe(mockEntity.id);
    expect(result.name).toBe('Loyer');
    expect(result.amount).toBe(1200);
    expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    expect(mockBudget.recalculate).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should hand the asset link to the repository', async () => {
    const assetId = '8a0f6c80-1234-4e5f-89ab-444444444444';

    await useCase.execute(
      {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Prêt auto',
        amount: 300,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        assetId,
      },
      mockUser,
    );

    expect(mockRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assetId }),
    );
  });

  it('should hand the account to the repository, none when absent', async () => {
    const compteCourantId = '8a0f6c80-1234-4e5f-89ab-555555555555';
    const dto = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Loyer',
      amount: 1500,
      kind: 'expense' as const,
      recurrence: 'fixed' as const,
      isManuallyAdjusted: false,
    };

    await useCase.execute({ ...dto, accountId: compteCourantId }, mockUser);
    await useCase.execute(dto, mockUser);

    expect(mockRepo.insert.mock.calls[0][0].accountId).toBe(compteCourantId);
    expect(mockRepo.insert.mock.calls[1][0].accountId).toBeNull();
  });

  describe('default account (PUL-378)', () => {
    const compteCourantId = '8a0f6c80-1234-4e5f-89ab-555555555555';
    const livretId = '8a0f6c80-1234-4e5f-89ab-666666666666';
    const base = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      recurrence: 'fixed' as const,
      isManuallyAdjusted: false,
    };

    it('CA32, CA36: « Loyer » 1 500 and « Salaire » 6 000 created without account take the Compte courant', async () => {
      mockUserRepo.findDefaultAccountId.mockResolvedValue(compteCourantId);

      await useCase.execute(
        { ...base, name: 'Loyer', amount: 1500, kind: 'expense' },
        mockUser,
      );
      await useCase.execute(
        { ...base, name: 'Salaire', amount: 6000, kind: 'income' },
        mockUser,
      );

      expect(mockRepo.insert.mock.calls[0][0].accountId).toBe(compteCourantId);
      expect(mockRepo.insert.mock.calls[1][0].accountId).toBe(compteCourantId);
    });

    it('CA32: a prévision created with « Aucun » stays without account', async () => {
      mockUserRepo.findDefaultAccountId.mockResolvedValue(compteCourantId);

      await useCase.execute(
        {
          ...base,
          name: 'Loyer',
          amount: 1500,
          kind: 'expense',
          accountId: null,
        },
        mockUser,
      );

      expect(mockRepo.insert.mock.calls[0][0].accountId).toBeNull();
      expect(mockUserRepo.findDefaultAccountId).not.toHaveBeenCalled();
    });

    it('CA45: Livret by default, an Épargne 500 « Versée sur » Livret without account is accepted without one', async () => {
      mockUserRepo.findDefaultAccountId.mockResolvedValue(livretId);

      await useCase.execute(
        {
          ...base,
          name: 'Épargne mensuelle',
          amount: 500,
          kind: 'saving',
          assetId: livretId,
        },
        mockUser,
      );

      const input = mockRepo.insert.mock.calls[0][0];
      expect(input.assetId).toBe(livretId);
      expect(input.accountId).toBeNull();
    });
  });

  it('should date a line created checked with the server clock, not the client one', async () => {
    const before = Date.now();

    await useCase.execute(
      {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Virement livret',
        amount: 500,
        kind: 'saving',
        recurrence: 'one_off',
        isManuallyAdjusted: false,
        checkedAt: '2099-01-01T00:00:00.000Z',
      },
      mockUser,
    );

    const { checkedAt } = mockRepo.insert.mock.calls[0][0];
    const stamped = Date.parse(checkedAt);
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });

  it('should throw when budgetId is missing', async () => {
    const dto = {
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
    } as BudgetLineCreate;

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
    expect(mockRepo.insert).not.toHaveBeenCalled();
  });

  it('should throw BUDGET_LINE_ALREADY_EXISTS on 23505 insert error', async () => {
    const dto: BudgetLineCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
    };
    mockRepo.insert.mockRejectedValueOnce(
      new BusinessException(
        {
          code: 'ERR_BUDGET_LINE_ALREADY_EXISTS',
          message: () => 'exists',
          httpStatus: 409,
        },
        {},
      ),
    );

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
  });

  it('should invalidate cache even when recalculate rejects', async () => {
    const dto: BudgetLineCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
    };
    mockBudget.recalculate.mockRejectedValueOnce(new Error('recalc failed'));

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      'recalc failed',
    );

    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });
});
