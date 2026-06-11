import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { CheckTransactionsUseCase } from './check-transactions.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Transaction } from '@modules/transaction/domain/transaction.entity';

const mockTransactions: Transaction[] = [
  {
    id: 'transaction-1',
    budgetId: 'budget-1',
    budgetLineId: 'line-1',
    name: 'Courses',
    amount: 75,
    originalAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    kind: 'expense',
    category: null,
    transactionDate: '2026-01-01',
    checkedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('CheckTransactionsUseCase', () => {
  let useCase: CheckTransactionsUseCase;
  let mockRepo: {
    validateAccess: ReturnType<typeof jest.fn>;
    checkUncheckedTransactionsRpc: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let callOrder: string[];

  beforeEach(async () => {
    callOrder = [];
    mockRepo = {
      validateAccess: jest.fn().mockImplementation(async () => {
        callOrder.push('validateAccess');
      }),
      checkUncheckedTransactionsRpc: jest.fn().mockImplementation(async () => {
        callOrder.push('checkUncheckedTransactionsRpc');
        return mockTransactions;
      }),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        CheckTransactionsUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${CheckTransactionsUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(CheckTransactionsUseCase);
  });

  it('should validate access before checking transactions via rpc', async () => {
    const result = await useCase.execute('line-1', mockUser);

    expect(result).toEqual(mockTransactions);
    expect(mockRepo.validateAccess).toHaveBeenCalledWith('line-1', mockUser.id);
    expect(callOrder).toEqual([
      'validateAccess',
      'checkUncheckedTransactionsRpc',
    ]);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should not call rpc when access validation fails', async () => {
    mockRepo.validateAccess.mockRejectedValueOnce(new Error('Access denied'));

    await expect(useCase.execute('line-1', mockUser)).rejects.toThrow(
      'Access denied',
    );

    expect(mockRepo.checkUncheckedTransactionsRpc).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
  });
});
