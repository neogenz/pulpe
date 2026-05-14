import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { UpdateBudgetLineUseCase } from './update-budget-line.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLine } from '../domain/budget-line.entity';
import type { BudgetLineUpdate } from 'pulpe-shared';

const mockEntity: BudgetLine = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  budgetId: '123e4567-e89b-12d3-a456-426614174001',
  templateLineId: null,
  savingsGoalId: null,
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

describe('UpdateBudgetLineUseCase', () => {
  let useCase: UpdateBudgetLineUseCase;
  let mockRepo: { update: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = { update: jest.fn().mockResolvedValue(mockEntity) };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };
    mockBudget = { recalculate: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        UpdateBudgetLineUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        {
          provide: `INFO_LOGGER:${UpdateBudgetLineUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(UpdateBudgetLineUseCase);
  });

  it('should update a budget line and trigger recalculation', async () => {
    const dto: BudgetLineUpdate = { id: mockEntity.id, amount: 1500 };

    const result = await useCase.execute(mockEntity.id, dto, mockUser);

    expect(result).toEqual(mockEntity);
    expect(mockRepo.update).toHaveBeenCalledTimes(1);
    expect(mockBudget.recalculate).toHaveBeenCalledWith(mockEntity.budgetId);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('should override exchange rate before calling repo.update', async () => {
    const dto: BudgetLineUpdate = { id: mockEntity.id, amount: 1500 };
    const callOrder: string[] = [];
    mockCurrency.overrideExchangeRate.mockImplementationOnce(async (d) => {
      callOrder.push('currency');
      return d;
    });
    mockRepo.update.mockImplementationOnce(async () => {
      callOrder.push('repo');
      return mockEntity;
    });

    await useCase.execute(mockEntity.id, dto, mockUser);

    expect(callOrder).toEqual(['currency', 'repo']);
  });

  it('should build a partial patch — only updated fields reach the repo', async () => {
    const dto: BudgetLineUpdate = {
      id: mockEntity.id,
      name: 'Loyer Q1',
      amount: 1400,
    };

    await useCase.execute(mockEntity.id, dto, mockUser);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch).toEqual({ name: 'Loyer Q1', amount: 1400 });
    expect(patch).not.toHaveProperty('kind');
    expect(patch).not.toHaveProperty('recurrence');
  });

  it('should reject a negative amount via invariants (no repo call)', async () => {
    const dto: BudgetLineUpdate = { id: mockEntity.id, amount: -50 };

    await expect(useCase.execute(mockEntity.id, dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
    expect(mockRepo.update).not.toHaveBeenCalled();
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
  });

  it('should reject an empty name via invariants (no repo call)', async () => {
    const dto: BudgetLineUpdate = { id: mockEntity.id, name: '   ' };

    await expect(useCase.execute(mockEntity.id, dto, mockUser)).rejects.toThrow(
      BusinessException,
    );
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('should propagate repo.update errors without recalculation', async () => {
    const repoError = new Error('row not found');
    mockRepo.update.mockRejectedValueOnce(repoError);

    await expect(
      useCase.execute(
        mockEntity.id,
        { id: mockEntity.id, amount: 1500 },
        mockUser,
      ),
    ).rejects.toThrow(repoError);
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
  });

  it('should call recalculate AFTER repo.update succeeds', async () => {
    const callOrder: string[] = [];
    mockRepo.update.mockImplementationOnce(async () => {
      callOrder.push('repo');
      return mockEntity;
    });
    mockBudget.recalculate.mockImplementationOnce(async () => {
      callOrder.push('recalculate');
    });

    await useCase.execute(
      mockEntity.id,
      { id: mockEntity.id, amount: 1500 },
      mockUser,
    );

    expect(callOrder).toEqual(['repo', 'recalculate']);
  });
});
