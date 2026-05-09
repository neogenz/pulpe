import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BulkTemplateLineOperationsUseCase } from './bulk-template-line-operations.use-case';
import { BUDGET_TEMPLATE_REPOSITORY } from '../domain/ports/budget-template-repository.port';
import { BUDGET_RECALCULATION_PORT } from '@modules/budget/domain/ports/budget-recalculation.port';
import { CurrencyService } from '@modules/currency/currency.service';
import { CacheService } from '@modules/cache/cache.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TemplateLine } from '../domain/budget-template.entity';
import type { TemplateLinesBulkOperations } from 'pulpe-shared';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const makeTemplateLine = (id: string): TemplateLine => ({
  id,
  templateId: 'template-1',
  name: 'Salaire',
  amount: 5000,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'income',
  recurrence: 'fixed',
  description: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('BulkTemplateLineOperationsUseCase — atomicity', () => {
  let useCase: BulkTemplateLineOperationsUseCase;
  let mockRepo: {
    validateAccess: ReturnType<typeof jest.fn>;
    validateLinesExist: ReturnType<typeof jest.fn>;
    updateLine: ReturnType<typeof jest.fn>;
    insertLine: ReturnType<typeof jest.fn>;
    fetchFutureBudgets: ReturnType<typeof jest.fn>;
    bulkApplyTemplateLineOperations: ReturnType<typeof jest.fn>;
  };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };
  let mockBudgetRecalculation: { recalculate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      validateAccess: jest.fn().mockResolvedValue(undefined),
      validateLinesExist: jest
        .fn()
        .mockResolvedValue(['a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d']),
      updateLine: jest
        .fn()
        .mockResolvedValue(
          makeTemplateLine('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'),
        ),
      insertLine: jest.fn().mockResolvedValue(makeTemplateLine('line-new-1')),
      fetchFutureBudgets: jest
        .fn()
        .mockResolvedValue([{ id: 'budget-1', month: 6, year: 2026 }]),
      bulkApplyTemplateLineOperations: jest.fn().mockResolvedValue({
        affectedBudgetIds: ['budget-1'],
        updatedLines: [
          makeTemplateLine('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'),
        ],
        createdLines: [makeTemplateLine('line-new-1')],
      }),
    };
    mockCurrency = {
      overrideExchangeRate: jest
        .fn()
        .mockImplementation((dto) => Promise.resolve(dto)),
    };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };
    mockBudgetRecalculation = {
      recalculate: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        BulkTemplateLineOperationsUseCase,
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockRepo },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: CacheService, useValue: mockCache },
        {
          provide: BUDGET_RECALCULATION_PORT,
          useValue: mockBudgetRecalculation,
        },
        {
          provide: `INFO_LOGGER:${BulkTemplateLineOperationsUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(BulkTemplateLineOperationsUseCase);
  });

  /**
   * ATOMICITY REGRESSION
   *
   * Post-fix: the use case calls a single atomic repo method
   * (`bulkApplyTemplateLineOperations`) that wraps all template-line UPDATE,
   * INSERT, DELETE, and budget propagation inside one Postgres function
   * (SECURITY DEFINER, single transaction).
   *
   * The use case must NOT fall back to the per-line `updateLine` / `insertLine`
   * paths for the bulk flow — if it does, the atomicity guarantee is lost
   * because those individual REST calls each commit independently.
   */
  it('uses only the atomic bulk RPC — never per-line updateLine / insertLine', async () => {
    const payload: TemplateLinesBulkOperations = {
      update: [
        {
          id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          name: 'Updated Salaire',
          amount: 5500,
          kind: 'income',
          recurrence: 'fixed',
          description: '',
        },
      ],
      create: [
        {
          name: 'New Ligne',
          amount: 200,
          kind: 'expense',
          recurrence: 'one_off',
          description: '',
        },
      ],
      delete: [],
      propagateToBudgets: true,
    };

    await useCase.execute('template-1', payload, mockUser, null);

    expect(mockRepo.bulkApplyTemplateLineOperations).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateLine).not.toHaveBeenCalled();
    expect(mockRepo.insertLine).not.toHaveBeenCalled();
  });

  it('propagates a failure of the atomic bulk RPC to the caller without partial commits', async () => {
    const rpcError = new Error('RPC apply_template_line_operations failed');
    mockRepo.bulkApplyTemplateLineOperations.mockRejectedValueOnce(rpcError);

    const payload: TemplateLinesBulkOperations = {
      update: [
        {
          id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          name: 'Updated Salaire',
          amount: 5500,
          kind: 'income',
          recurrence: 'fixed',
          description: '',
        },
      ],
      create: [
        {
          name: 'New Ligne',
          amount: 200,
          kind: 'expense',
          recurrence: 'one_off',
          description: '',
        },
      ],
      delete: [],
      propagateToBudgets: true,
    };

    await expect(
      useCase.execute('template-1', payload, mockUser, null),
    ).rejects.toThrow('RPC apply_template_line_operations failed');

    // Per-line write methods are never called — all template writes live
    // inside the atomic RPC, so failure rolls back at the SQL level.
    expect(mockRepo.updateLine).not.toHaveBeenCalled();
    expect(mockRepo.insertLine).not.toHaveBeenCalled();
  });

  it('returns updated and created entities from the atomic bulk RPC result', async () => {
    const payload: TemplateLinesBulkOperations = {
      update: [
        {
          id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          name: 'Updated Salaire',
          amount: 5500,
          kind: 'income',
          recurrence: 'fixed',
          description: '',
        },
      ],
      create: [
        {
          name: 'New Ligne',
          amount: 200,
          kind: 'expense',
          recurrence: 'one_off',
          description: '',
        },
      ],
      delete: [],
      propagateToBudgets: true,
    };

    const result = await useCase.execute('template-1', payload, mockUser, null);

    expect(result.updatedLines).toHaveLength(1);
    expect(result.updatedLines[0].id).toBe(
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    );
    expect(result.createdLines).toHaveLength(1);
    expect(result.createdLines[0].id).toBe('line-new-1');
    expect(result.propagation.affectedBudgetIds).toEqual(['budget-1']);
  });
});
