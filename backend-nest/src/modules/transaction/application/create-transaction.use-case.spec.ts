import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { SAVINGS_GOAL_WITHDRAWAL_POLICY } from '@modules/savings-goal/domain/ports/savings-goal-withdrawal-policy.port';
import { BusinessException } from '@common/exceptions/business.exception';
import type { TransactionCreate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Transaction } from '../domain/transaction.entity';

const mockTransactionEntity: Transaction = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  budgetId: '123e4567-e89b-12d3-a456-426614174001',
  budgetLineId: null,
  amount: 50,
  name: 'Restaurant',
  kind: 'expense',
  transactionDate: '2024-01-15T12:00:00Z',
  tagIds: [],
  checkedAt: null,
  createdAt: '2024-01-15T12:00:00Z',
  updatedAt: '2024-01-15T12:00:00Z',
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  sourceSavingsGoalId: null,
  sourceSavingsGoalName: null,
};

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('CreateTransactionUseCase', () => {
  let useCase: CreateTransactionUseCase;
  let mockRepo: {
    insert: ReturnType<typeof jest.fn>;
    insertWithdrawal: ReturnType<typeof jest.fn>;
    fetchBudgetLineForAllocation: ReturnType<typeof jest.fn>;
  };
  let mockWithdrawalPolicy: { runAgainstBalance: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      insert: jest.fn().mockResolvedValue(mockTransactionEntity),
      insertWithdrawal: jest.fn().mockResolvedValue(mockTransactionEntity),
      fetchBudgetLineForAllocation: jest.fn().mockResolvedValue(null),
    };
    mockWithdrawalPolicy = {
      runAgainstBalance: jest
        .fn()
        .mockImplementation((input) => input.write(5)),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };
    mockBudget = {
      recalculate: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateTransactionUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        {
          provide: SAVINGS_GOAL_WITHDRAWAL_POLICY,
          useValue: mockWithdrawalPolicy,
        },
        {
          provide: `INFO_LOGGER:${CreateTransactionUseCase.name}`,
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

    useCase = module.get(CreateTransactionUseCase);
  });

  it('should create a transaction successfully', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };

    const result = await useCase.execute(dto, mockUser);

    expect(result.name).toBe('Restaurant');
    expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    expect(mockBudget.recalculate).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should throw when budgetId is missing', async () => {
    const dto = {
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
    } as TransactionCreate;

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
    expect(mockRepo.insert).not.toHaveBeenCalled();
  });

  it('should throw when amount is zero', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Restaurant',
      amount: 0,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
    expect(mockRepo.insert).not.toHaveBeenCalled();
  });

  it('should validate budget line allocation when budgetLineId is provided', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      budgetLineId: 'line-1',
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };
    mockRepo.fetchBudgetLineForAllocation.mockResolvedValueOnce({
      id: 'line-1',
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      kind: 'expense',
      sourceSavingsGoalId: null,
      sourceSavingsGoalName: null,
    });

    const result = await useCase.execute(dto, mockUser);

    expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(mockRepo.fetchBudgetLineForAllocation).toHaveBeenCalledWith(
      'line-1',
    );
  });

  it('should throw when budget line budget does not match', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      budgetLineId: 'line-1',
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };
    mockRepo.fetchBudgetLineForAllocation.mockResolvedValueOnce({
      id: 'line-1',
      budgetId: 'different-budget',
      kind: 'expense',
      sourceSavingsGoalId: null,
      sourceSavingsGoalName: null,
    });

    await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
  });

  it('should throw TRANSACTION_ALREADY_EXISTS on duplicate id', async () => {
    const dto: TransactionCreate = {
      budgetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Restaurant',
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-15T12:00:00Z',
    };
    mockRepo.insert.mockRejectedValueOnce(
      new BusinessException(
        {
          code: 'ERR_TRANSACTION_ALREADY_EXISTS',
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

  describe('savings-goal withdrawal (PUL-329)', () => {
    const goalId = '123e4567-e89b-12d3-a456-426614174009';

    it('should write an ordinary transaction without consulting the balance', async () => {
      const dto: TransactionCreate = {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Salaire',
        amount: 5000,
        kind: 'income',
        transactionDate: '2024-01-15T12:00:00Z',
      };

      await useCase.execute(dto, mockUser);

      expect(mockWithdrawalPolicy.runAgainstBalance).not.toHaveBeenCalled();
      expect(mockRepo.insertWithdrawal).not.toHaveBeenCalled();
    });

    it('should write a linked income under the policy, carrying its revision', async () => {
      const dto: TransactionCreate = {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Apport travaux',
        amount: 4500,
        kind: 'income',
        transactionDate: '2024-01-15T12:00:00Z',
        sourceSavingsGoalId: goalId,
      };

      await useCase.execute(dto, mockUser);

      expect(mockWithdrawalPolicy.runAgainstBalance).toHaveBeenCalledTimes(1);
      expect(mockRepo.insert).not.toHaveBeenCalled();
      const [input] = mockWithdrawalPolicy.runAgainstBalance.mock.calls[0];
      expect(input.goalId).toBe(goalId);
      expect(input.debit).toBe(4500);
      expect(mockRepo.insertWithdrawal).toHaveBeenCalledWith(
        expect.objectContaining({ sourceSavingsGoalId: goalId }),
        5,
      );
    });

    it('should debit the converted amount, not the original one (RG-009)', async () => {
      const dto: TransactionCreate = {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Apport travaux',
        amount: 4200,
        originalAmount: 4500,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.9333,
        kind: 'income',
        transactionDate: '2024-01-15T12:00:00Z',
        sourceSavingsGoalId: goalId,
      };

      await useCase.execute(dto, mockUser);

      const [input] = mockWithdrawalPolicy.runAgainstBalance.mock.calls[0];
      expect(input.debit).toBe(4200);
    });

    it('should not touch the budget when the balance refuses the withdrawal', async () => {
      const dto: TransactionCreate = {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Apport travaux',
        amount: 99_999,
        kind: 'income',
        transactionDate: '2024-01-15T12:00:00Z',
        sourceSavingsGoalId: goalId,
      };
      mockWithdrawalPolicy.runAgainstBalance.mockRejectedValueOnce(
        new BusinessException(
          {
            code: 'ERR_SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE',
            message: () => 'not enough',
            httpStatus: 422,
          },
          {},
        ),
      );

      await expect(useCase.execute(dto, mockUser)).rejects.toThrow(
        BusinessException,
      );
      expect(mockRepo.insertWithdrawal).not.toHaveBeenCalled();
      expect(mockBudget.recalculate).not.toHaveBeenCalled();
    });
  });

  // Réaliser un retrait planifié : le client n'envoie jamais l'objectif — son
  // contrat le lui interdit dès qu'il alloue — et le serveur le lit sur la
  // prévision. C'est ce qui empêche d'inventer une origine sur une prévision
  // qui n'en porte pas, et de compter le prévu et le réel deux fois.
  describe('realizing a planned withdrawal (PUL-329 v2)', () => {
    const goalId = '123e4567-e89b-12d3-a456-426614174009';
    const budgetId = '123e4567-e89b-12d3-a456-426614174001';

    const realization: TransactionCreate = {
      budgetId,
      budgetLineId: 'line-1',
      name: 'Retrait vacances',
      amount: 500,
      kind: 'income',
      transactionDate: '2024-01-15T12:00:00Z',
    };

    const sourceLine = (overrides: Record<string, unknown> = {}) => ({
      id: 'line-1',
      budgetId,
      kind: 'income',
      sourceSavingsGoalId: goalId,
      sourceSavingsGoalName: 'Vacances',
      ...overrides,
    });

    it('should inherit the goal from the forecast and debit it atomically', async () => {
      mockRepo.fetchBudgetLineForAllocation.mockResolvedValueOnce(sourceLine());

      await useCase.execute(realization, mockUser);

      const [input] = mockWithdrawalPolicy.runAgainstBalance.mock.calls[0];
      expect(input.goalId).toBe(goalId);
      expect(input.debit).toBe(500);
      expect(mockRepo.insert).not.toHaveBeenCalled();
      expect(mockRepo.insertWithdrawal).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetLineId: 'line-1',
          sourceSavingsGoalId: goalId,
        }),
        5,
      );
    });

    it('should leave an ordinary allocated income out of the balance path', async () => {
      mockRepo.fetchBudgetLineForAllocation.mockResolvedValueOnce(
        sourceLine({ sourceSavingsGoalId: null, sourceSavingsGoalName: null }),
      );

      await useCase.execute(realization, mockUser);

      expect(mockWithdrawalPolicy.runAgainstBalance).not.toHaveBeenCalled();
      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    });

    // Le nom survit à la suppression de l'objectif, l'identifiant non : sans
    // cette garde, réaliser une prévision orpheline la transformerait en revenu
    // ordinaire — l'argent apparaîtrait sans sortir d'aucun pot.
    it('should refuse to realize a forecast whose goal was deleted', async () => {
      mockRepo.fetchBudgetLineForAllocation.mockResolvedValueOnce(
        sourceLine({ sourceSavingsGoalId: null }),
      );

      await expect(useCase.execute(realization, mockUser)).rejects.toThrow(
        /no longer exists/,
      );
      expect(mockRepo.insert).not.toHaveBeenCalled();
      expect(mockRepo.insertWithdrawal).not.toHaveBeenCalled();
      expect(mockBudget.recalculate).not.toHaveBeenCalled();
    });

    it('should write nothing when the confirmed balance is insufficient', async () => {
      mockRepo.fetchBudgetLineForAllocation.mockResolvedValueOnce(sourceLine());
      mockWithdrawalPolicy.runAgainstBalance.mockRejectedValueOnce(
        new BusinessException(
          {
            code: 'ERR_SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE',
            message: () => 'not enough',
            httpStatus: 422,
          },
          {},
        ),
      );

      await expect(useCase.execute(realization, mockUser)).rejects.toThrow(
        BusinessException,
      );
      expect(mockRepo.insertWithdrawal).not.toHaveBeenCalled();
      expect(mockBudget.recalculate).not.toHaveBeenCalled();
    });
  });

  describe('cache invalidation ordering (R1)', () => {
    it('should invalidate cache BEFORE recalc — proven by call order', async () => {
      const dto: TransactionCreate = {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Restaurant',
        amount: 50,
        kind: 'expense',
        transactionDate: '2024-01-15T12:00:00Z',
      };
      const callOrder: string[] = [];
      mockCache.invalidateForUser.mockImplementationOnce(async () => {
        callOrder.push('invalidate');
      });
      mockBudget.recalculate.mockImplementationOnce(async () => {
        callOrder.push('recalculate');
      });

      await useCase.execute(dto, mockUser);

      expect(callOrder).toEqual(['invalidate', 'recalculate']);
    });

    it('should still invalidate cache when recalc throws (no stale 30s window)', async () => {
      const dto: TransactionCreate = {
        budgetId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Restaurant',
        amount: 50,
        kind: 'expense',
        transactionDate: '2024-01-15T12:00:00Z',
      };
      mockBudget.recalculate.mockRejectedValueOnce(new Error('DB unreachable'));

      try {
        await useCase.execute(dto, mockUser);
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(
          'ERR_TRANSACTION_CREATE_FAILED',
        );
      }

      expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
