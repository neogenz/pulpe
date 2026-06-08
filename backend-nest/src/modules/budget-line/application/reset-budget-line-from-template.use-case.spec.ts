import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { ResetBudgetLineFromTemplateUseCase } from './reset-budget-line-from-template.use-case';
import { BUDGET_LINE_REPOSITORY } from '../domain/ports/budget-line-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLine, TemplateLine } from '../domain/budget-line.entity';

const mockEntity: BudgetLine = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  budgetId: '123e4567-e89b-12d3-a456-426614174001',
  templateLineId: '123e4567-e89b-12d3-a456-426614174002',
  savingsGoalId: null,
  name: 'Loyer ajusté',
  amount: 1500,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'fixed',
  isManuallyAdjusted: true,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockTemplateLine: TemplateLine = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  templateId: '123e4567-e89b-12d3-a456-426614174003',
  name: 'Loyer',
  amount: 1200,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'fixed',
  description: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('ResetBudgetLineFromTemplateUseCase', () => {
  let useCase: ResetBudgetLineFromTemplateUseCase;
  let mockRepo: {
    findById: ReturnType<typeof jest.fn>;
    fetchTemplateLineById: ReturnType<typeof jest.fn>;
    update: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockBudget: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(mockEntity),
      fetchTemplateLineById: jest.fn().mockResolvedValue(mockTemplateLine),
      update: jest.fn().mockResolvedValue(mockEntity),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockBudget = { recalculate: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ResetBudgetLineFromTemplateUseCase,
        { provide: BUDGET_LINE_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudget },
        {
          provide: `INFO_LOGGER:${ResetBudgetLineFromTemplateUseCase.name}`,
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

    useCase = module.get(ResetBudgetLineFromTemplateUseCase);
  });

  it('should reset the line, invalidate cache, and trigger recalculation', async () => {
    const result = await useCase.execute(mockEntity.id, mockUser);

    expect(result).toEqual(mockEntity);
    expect(mockRepo.update).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
    expect(mockBudget.recalculate).toHaveBeenCalledWith(mockEntity.budgetId);
  });

  it('should reject when the line has no associated template (no mutation)', async () => {
    mockRepo.findById.mockResolvedValueOnce({
      ...mockEntity,
      templateLineId: null,
    });

    await expect(useCase.execute(mockEntity.id, mockUser)).rejects.toThrow(
      BusinessException,
    );
    expect(mockRepo.update).not.toHaveBeenCalled();
    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
    expect(mockBudget.recalculate).not.toHaveBeenCalled();
  });

  it('should invalidate cache even when recalculate rejects', async () => {
    mockBudget.recalculate.mockRejectedValueOnce(new Error('recalc failed'));

    await expect(useCase.execute(mockEntity.id, mockUser)).rejects.toThrow(
      'recalc failed',
    );

    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });
});
