import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CreateBudgetUseCase } from './create-budget.use-case';
import { BUDGET_REPOSITORY } from '../domain/ports/budget-repository.port';
import { BUDGET_RECALCULATION_PORT } from '../domain/ports/budget-recalculation.port';
import { CacheService } from '@modules/cache/cache.service';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Budget } from '../domain/budget.entity';
import type { BudgetCreate } from 'pulpe-shared';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const mockBudget: Budget = {
  id: 'budget-1',
  userId: 'user-1',
  templateId: 'template-1',
  month: 6,
  year: 2026,
  description: 'Test',
  endingBalance: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

describe('CreateBudgetUseCase — cache invalidation ordering (R1)', () => {
  let useCase: CreateBudgetUseCase;
  let mockRepo: {
    fetchBudgetIdByPeriod: ReturnType<typeof jest.fn>;
    createBudgetFromTemplateRpc: ReturnType<typeof jest.fn>;
    fetchBudgetById: ReturnType<typeof jest.fn>;
  };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockBudgetRecalc: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      fetchBudgetIdByPeriod: jest.fn().mockResolvedValue(null),
      createBudgetFromTemplateRpc: jest.fn().mockResolvedValue({
        budget: mockBudget,
        budget_lines_created: 5,
        template_name: 'Standard',
      }),
      fetchBudgetById: jest.fn().mockResolvedValue(mockBudget),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockBudgetRecalc = { recalculate: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        CreateBudgetUseCase,
        { provide: BUDGET_REPOSITORY, useValue: mockRepo },
        { provide: BUDGET_RECALCULATION_PORT, useValue: mockBudgetRecalc },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${CreateBudgetUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(CreateBudgetUseCase);
  });

  const dto: BudgetCreate = {
    templateId: '11111111-1111-1111-1111-111111111111',
    month: 6,
    year: 2026,
    description: 'Test',
  };

  it('should invalidate cache BEFORE recalc — proven by call order', async () => {
    const callOrder: string[] = [];
    mockCache.invalidateForUser.mockImplementationOnce(async () => {
      callOrder.push('invalidate');
    });
    mockBudgetRecalc.recalculate.mockImplementationOnce(async () => {
      callOrder.push('recalculate');
    });

    await useCase.execute(dto, mockUser);

    expect(callOrder).toEqual(['invalidate', 'recalculate']);
  });

  it('should still invalidate cache when recalc throws (no stale 30s window)', async () => {
    mockBudgetRecalc.recalculate.mockRejectedValueOnce(
      new Error('DB unreachable'),
    );

    try {
      await useCase.execute(dto, mockUser);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(
        'ERR_BUDGET_CREATE_FAILED',
      );
    }

    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });
});
