import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { FindBudgetLinesBySpreadGroupUseCase } from './find-budget-lines-by-spread-group.use-case';
import type { SpreadOccurrence } from '../domain/budget-line.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const occurrence = (month: number): SpreadOccurrence => ({
  budgetLineId: `line-${month}`,
  budgetId: `budget-${month}`,
  month,
  year: 2026,
  name: 'Prime assurance',
  amount: 100,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  checkedAt: null,
});

describe('FindBudgetLinesBySpreadGroupUseCase', () => {
  let useCase: FindBudgetLinesBySpreadGroupUseCase;
  let mockRepo: { findBySpreadGroupId: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = { findBySpreadGroupId: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        FindBudgetLinesBySpreadGroupUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${FindBudgetLinesBySpreadGroupUseCase.name}`,
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

    useCase = module.get(FindBudgetLinesBySpreadGroupUseCase);
  });

  it('returns the occurrences of an owned spread group', async () => {
    mockRepo.findBySpreadGroupId.mockResolvedValue([
      occurrence(1),
      occurrence(2),
      occurrence(3),
    ]);

    const result = await useCase.execute('spread-1', mockUser);

    expect(result).toHaveLength(3);
    expect(mockRepo.findBySpreadGroupId).toHaveBeenCalledWith('spread-1');
  });

  it('throws 404 when the group is empty (not found or not owned)', async () => {
    mockRepo.findBySpreadGroupId.mockResolvedValue([]);

    await expect(useCase.execute('spread-x', mockUser)).rejects.toThrow(
      BusinessException,
    );
  });
});
