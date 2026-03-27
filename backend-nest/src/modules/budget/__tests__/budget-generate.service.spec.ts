import { describe, it, expect, beforeEach, spyOn, type Mock } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BudgetService } from '../budget.service';
import { BudgetCalculator } from '../budget.calculator';
import { BudgetValidator } from '../budget.validator';
import { BudgetRepository } from '../budget.repository';
import {
  createMockSupabaseClient,
  createMockAuthenticatedUser,
  createMockBudgetEntity,
  createMockPinoLogger,
  MOCK_TEMPLATE_ID,
  MOCK_USER_ID,
  type MockSupabaseClient,
} from '../../../test/test-mocks';
import { INFO_LOGGER_TOKEN } from '@common/logger';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { CacheService } from '@modules/cache/cache.service';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetGenerate } from 'pulpe-shared';

function budgetUuid(month: number, year: number): string {
  const hex = `${year}${String(month).padStart(2, '0')}`;
  return `00000000-0000-1000-8000-${hex.padStart(12, '0')}`;
}

function createBudgetEntityForMonth(month: number, year: number) {
  return createMockBudgetEntity({
    id: budgetUuid(month, year),
    month,
    year,
    description: `Budget ${month}/${year}`,
  });
}

function createRpcResult(month: number, year: number) {
  return {
    budget: createBudgetEntityForMonth(month, year),
    budget_lines_created: 3,
    template_name: 'Test Template',
  };
}

describe('BudgetService.generateBudgets', () => {
  let service: BudgetService;
  let mockSupabaseClient: MockSupabaseClient;
  let mockCalculator: Record<string, Mock<any>>;
  let mockCacheService: Record<string, Mock<any>>;
  let mockRepository: Record<string, Mock<any>>;
  const mockUser = createMockAuthenticatedUser();
  const mockPinoLogger = createMockPinoLogger();

  const baseDto: BudgetGenerate = {
    templateId: MOCK_TEMPLATE_ID,
    startMonth: 1,
    startYear: 2026,
    count: 3,
  };

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

    mockCalculator = {
      calculateEndingBalance: spyOn(
        { fn: () => Promise.resolve(100) },
        'fn',
      ).mockImplementation(() => Promise.resolve(100)),
      recalculateAndPersist: spyOn(
        { fn: () => Promise.resolve() },
        'fn',
      ).mockImplementation(() => Promise.resolve()),
      getRollover: spyOn(
        { fn: () => Promise.resolve({ rollover: 0, previousBudgetId: null }) },
        'fn',
      ).mockImplementation(() =>
        Promise.resolve({ rollover: 0, previousBudgetId: null }),
      ),
    };

    mockCacheService = {
      getOrSet: spyOn(
        {
          fn: (
            _u: string,
            _k: string,
            _t: number,
            fetcher: () => Promise<unknown>,
          ) => fetcher(),
        },
        'fn',
      ),
      invalidateForUser: spyOn(
        { fn: (_userId: string) => Promise.resolve() },
        'fn',
      ),
    };

    mockRepository = {
      getExistingPeriods: spyOn(
        { fn: () => Promise.resolve(new Set<string>()) },
        'fn',
      ).mockResolvedValue(new Set<string>()),
      deleteBudgetsByIds: spyOn(
        { fn: () => Promise.resolve(true) },
        'fn',
      ).mockResolvedValue(true),
      fetchBudgetById: spyOn(
        { fn: () => Promise.resolve(createMockBudgetEntity()) },
        'fn',
      ),
      fetchBudgetData: spyOn(
        {
          fn: () =>
            Promise.resolve({
              budget: null,
              transactions: [],
              budgetLines: [],
            }),
        },
        'fn',
      ),
      updateBudgetInDb: spyOn(
        { fn: () => Promise.resolve(createMockBudgetEntity()) },
        'fn',
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        BudgetService,
        {
          provide: BudgetCalculator,
          useValue: {
            calculateEndingBalance: (...args: unknown[]) =>
              mockCalculator.calculateEndingBalance(...args),
            recalculateAndPersist: (...args: unknown[]) =>
              mockCalculator.recalculateAndPersist(...args),
            getRollover: (...args: unknown[]) =>
              mockCalculator.getRollover(...args),
          },
        },
        {
          provide: BudgetValidator,
          useValue: {
            validateBudgetInput: (dto: unknown) => dto,
            validateUpdateBudgetDto: (dto: unknown) => dto,
            validateNoDuplicatePeriod: () => Promise.resolve(),
          },
        },
        {
          provide: BudgetRepository,
          useValue: {
            getExistingPeriods: (...args: unknown[]) =>
              mockRepository.getExistingPeriods(...args),
            deleteBudgetsByIds: (...args: unknown[]) =>
              mockRepository.deleteBudgetsByIds(...args),
            fetchBudgetById: (...args: unknown[]) =>
              mockRepository.fetchBudgetById(...args),
            fetchBudgetData: (...args: unknown[]) =>
              mockRepository.fetchBudgetData(...args),
            updateBudgetInDb: (...args: unknown[]) =>
              mockRepository.updateBudgetInDb(...args),
          },
        },
        {
          provide: `${INFO_LOGGER_TOKEN}:${BudgetService.name}`,
          useValue: mockPinoLogger,
        },
        {
          provide: EncryptionService,
          useValue: {
            getUserDEK: () => Promise.resolve(Buffer.alloc(32)),
            ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
            encryptAmount: () => 'encrypted-mock',
            tryDecryptAmount: (_ct: string, _dek: Buffer, fallback: number) =>
              fallback,
          },
        },
        {
          provide: CacheService,
          useValue: {
            getOrSet: (...args: unknown[]) =>
              mockCacheService.getOrSet(...args),
            invalidateForUser: (...args: unknown[]) =>
              mockCacheService.invalidateForUser(...args),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
  });

  describe('happy path', () => {
    it('should create N budgets with correct month sequence', async () => {
      // Arrange: no existing periods, RPC succeeds for each month
      mockRepository.getExistingPeriods.mockResolvedValue(new Set<string>());

      const executeSpy = spyOn(service as any, 'executeBudgetCreationRpc');
      executeSpy
        .mockResolvedValueOnce(createRpcResult(1, 2026))
        .mockResolvedValueOnce(createRpcResult(2, 2026))
        .mockResolvedValueOnce(createRpcResult(3, 2026));

      // Act
      const result = await service.generateBudgets(
        baseDto,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.budgets).toHaveLength(3);
      expect(result.data.skippedMonths).toHaveLength(0);
      expect(result.data.budgets[0].month).toBe(1);
      expect(result.data.budgets[1].month).toBe(2);
      expect(result.data.budgets[2].month).toBe(3);

      expect(mockRepository.getExistingPeriods).toHaveBeenCalledTimes(1);
      expect(executeSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('month-year rollover', () => {
    it('should roll over year when month exceeds 12', async () => {
      // Arrange
      const dto: BudgetGenerate = {
        ...baseDto,
        startMonth: 11,
        startYear: 2026,
        count: 4,
      };

      mockRepository.getExistingPeriods.mockResolvedValue(new Set<string>());

      const executeSpy = spyOn(service as any, 'executeBudgetCreationRpc');
      executeSpy
        .mockResolvedValueOnce(createRpcResult(11, 2026))
        .mockResolvedValueOnce(createRpcResult(12, 2026))
        .mockResolvedValueOnce(createRpcResult(1, 2027))
        .mockResolvedValueOnce(createRpcResult(2, 2027));

      // Act
      const result = await service.generateBudgets(
        dto,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result.data.budgets).toHaveLength(4);
      expect(result.data.budgets[0]).toMatchObject({ month: 11, year: 2026 });
      expect(result.data.budgets[1]).toMatchObject({ month: 12, year: 2026 });
      expect(result.data.budgets[2]).toMatchObject({ month: 1, year: 2027 });
      expect(result.data.budgets[3]).toMatchObject({ month: 2, year: 2027 });
    });
  });

  describe('skip existing months', () => {
    it('should skip months where budget already exists', async () => {
      // Arrange: month 2 already exists (returned by batch query)
      mockRepository.getExistingPeriods.mockResolvedValue(new Set(['2/2026']));

      const executeSpy = spyOn(service as any, 'executeBudgetCreationRpc');
      executeSpy
        .mockResolvedValueOnce(createRpcResult(1, 2026))
        .mockResolvedValueOnce(createRpcResult(3, 2026));

      // Act
      const result = await service.generateBudgets(
        baseDto,
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(result.data.budgets).toHaveLength(2);
      expect(result.data.skippedMonths).toHaveLength(1);
      expect(result.data.skippedMonths[0]).toEqual({ month: 2, year: 2026 });
      expect(executeSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('compensating transaction (rollback)', () => {
    it('should delete created budgets when RPC fails mid-generation', async () => {
      // Arrange: first 2 succeed, third fails
      mockRepository.getExistingPeriods.mockResolvedValue(new Set<string>());

      const executeSpy = spyOn(service as any, 'executeBudgetCreationRpc');
      executeSpy
        .mockResolvedValueOnce(createRpcResult(1, 2026))
        .mockResolvedValueOnce(createRpcResult(2, 2026))
        .mockRejectedValueOnce(new Error('RPC failure'));

      // Act + Assert
      await expect(
        service.generateBudgets(baseDto, mockUser, mockSupabaseClient as any),
      ).rejects.toThrow(BusinessException);

      expect(mockRepository.deleteBudgetsByIds).toHaveBeenCalledWith(
        mockSupabaseClient,
        [budgetUuid(1, 2026), budgetUuid(2, 2026)],
      );
    });

    it('should not call repository delete when no budgets were created', async () => {
      // Arrange: first RPC call fails immediately
      mockRepository.getExistingPeriods.mockResolvedValue(new Set<string>());

      spyOn(service as any, 'executeBudgetCreationRpc').mockRejectedValueOnce(
        new Error('RPC failure'),
      );

      // Act + Assert
      await expect(
        service.generateBudgets(baseDto, mockUser, mockSupabaseClient as any),
      ).rejects.toThrow(BusinessException);

      expect(mockRepository.deleteBudgetsByIds).not.toHaveBeenCalled();
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache once after all budgets are created', async () => {
      // Arrange
      mockRepository.getExistingPeriods.mockResolvedValue(new Set<string>());
      spyOn(service as any, 'executeBudgetCreationRpc').mockResolvedValue(
        createRpcResult(1, 2026),
      );

      // Act
      await service.generateBudgets(
        { ...baseDto, count: 1 },
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(mockCacheService.invalidateForUser).toHaveBeenCalledTimes(1);
      expect(mockCacheService.invalidateForUser).toHaveBeenCalledWith(
        MOCK_USER_ID,
      );
    });
  });

  describe('recalculateAndPersist', () => {
    it('should call recalculateAndPersist for each created budget', async () => {
      // Arrange
      mockRepository.getExistingPeriods.mockResolvedValue(new Set<string>());
      spyOn(service as any, 'executeBudgetCreationRpc')
        .mockResolvedValueOnce(createRpcResult(1, 2026))
        .mockResolvedValueOnce(createRpcResult(2, 2026));

      // Act
      await service.generateBudgets(
        { ...baseDto, count: 2 },
        mockUser,
        mockSupabaseClient as any,
      );

      // Assert
      expect(mockCalculator.recalculateAndPersist).toHaveBeenCalledTimes(2);
      expect(mockCalculator.recalculateAndPersist).toHaveBeenCalledWith(
        budgetUuid(1, 2026),
        mockSupabaseClient,
        mockUser.clientKey,
      );
      expect(mockCalculator.recalculateAndPersist).toHaveBeenCalledWith(
        budgetUuid(2, 2026),
        mockSupabaseClient,
        mockUser.clientKey,
      );
    });
  });
});
