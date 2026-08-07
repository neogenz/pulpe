import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { ToggleBudgetLineCheckUseCase } from './toggle-budget-line-check.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type {
  BudgetLine,
  BudgetLineAccess,
} from '../domain/budget-line.entity';

const mockEntity: BudgetLine = {
  id: 'line-1',
  budgetId: 'budget-1',
  templateLineId: null,
  savingsGoalId: null,
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
  checkedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ORDINARY_LINE_ACCESS: BudgetLineAccess = {
  sourceSavingsGoalId: null,
  checkedAt: mockEntity.checkedAt,
};

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('ToggleBudgetLineCheckUseCase', () => {
  let useCase: ToggleBudgetLineCheckUseCase;
  let mockRepo: {
    validateAccess: ReturnType<typeof jest.fn>;
    toggleCheckRpc: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let callOrder: string[];

  beforeEach(async () => {
    callOrder = [];
    mockRepo = {
      validateAccess: jest.fn().mockImplementation(async () => {
        callOrder.push('validateAccess');
        return ORDINARY_LINE_ACCESS;
      }),
      toggleCheckRpc: jest.fn().mockImplementation(async () => {
        callOrder.push('toggleCheckRpc');
        return mockEntity;
      }),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ToggleBudgetLineCheckUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${ToggleBudgetLineCheckUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(ToggleBudgetLineCheckUseCase);
  });

  it('should validate access before toggling the budget line via rpc', async () => {
    const result = await useCase.execute('line-1', mockUser);

    expect(result).toEqual(mockEntity);
    expect(mockRepo.validateAccess).toHaveBeenCalledWith('line-1', mockUser.id);
    expect(callOrder).toEqual(['validateAccess', 'toggleCheckRpc']);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should not call rpc when access validation fails', async () => {
    mockRepo.validateAccess.mockRejectedValueOnce(new Error('Access denied'));

    await expect(useCase.execute('line-1', mockUser)).rejects.toThrow(
      'Access denied',
    );

    expect(mockRepo.toggleCheckRpc).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
  });

  // Cocher un retrait planifié dirait « l'argent est sorti » sans qu'aucune
  // écriture ne l'ait retiré du pot : le solde confirmé resterait entier et le
  // revenu serait compté alors qu'aucun réel n'existe.
  it('should refuse to check a planned withdrawal, which is realized by its transaction', async () => {
    mockRepo.validateAccess.mockResolvedValueOnce({
      sourceSavingsGoalId: 'goal-1',
      checkedAt: null,
    });

    await expect(useCase.execute('line-1', mockUser)).rejects.toThrow(
      /not by checking it/,
    );

    expect(mockRepo.toggleCheckRpc).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
  });

  // Seul le passage à pointé est fermé : dépointer une donnée historique
  // incohérente est le geste qui la répare.
  it('should still allow unchecking a planned withdrawal left checked', async () => {
    mockRepo.validateAccess.mockResolvedValueOnce({
      sourceSavingsGoalId: 'goal-1',
      checkedAt: '2026-08-01T00:00:00.000Z',
    });

    await useCase.execute('line-1', mockUser);

    expect(mockRepo.toggleCheckRpc).toHaveBeenCalledWith('line-1');
  });
});
