import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { SearchTransactionsUseCase } from './search-transactions.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('SearchTransactionsUseCase', () => {
  let useCase: SearchTransactionsUseCase;
  let mockRepo: {
    fetchTransactionsByPattern: ReturnType<typeof jest.fn>;
    fetchBudgetLinesByPattern: ReturnType<typeof jest.fn>;
    fetchBudgetIdsByYears: ReturnType<typeof jest.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      fetchTransactionsByPattern: jest.fn().mockResolvedValue([]),
      fetchBudgetLinesByPattern: jest.fn().mockResolvedValue([]),
      fetchBudgetIdsByYears: jest.fn().mockResolvedValue([]),
    };
    mockLogger = {
      info: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        SearchTransactionsUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${SearchTransactionsUseCase.name}`,
          useValue: {
            error: () => {},
            warn: () => {},
            info: mockLogger.info,
            debug: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(SearchTransactionsUseCase);
  });

  describe('literal standalone PostgREST search pattern', () => {
    const executeQuery = (query: string) =>
      useCase.execute({ q: query }, mockUser);
    const transactionPattern = () =>
      mockRepo.fetchTransactionsByPattern.mock.calls[0][0].searchPattern;

    it('should use PostgreSQL literal mode without the obsolete .or() quotes', async () => {
      await executeQuery('Restaurant');
      expect(transactionPattern()).toBe('***=Restaurant');
    });

    it('keeps punctuation, quotes, backslashes, wildcards and regex directives literal', async () => {
      const queries = [
        'a, b.c: d (e)',
        'a\\b',
        'say "hi"',
        '100%_off*deal',
        '(?i).*|[x]+$',
        '***=literal',
      ];

      for (const q of queries) {
        await expect(executeQuery(q)).resolves.toEqual([]);
      }
      expect(
        mockRepo.fetchTransactionsByPattern.mock.calls.map(
          ([criteria]) => criteria.searchPattern,
        ),
      ).toEqual(queries.map((q) => `***=${q}`));
    });

    it('should pass identical pattern to both transaction and budget-line repo calls', async () => {
      await executeQuery('hello, world');

      const txPattern =
        mockRepo.fetchTransactionsByPattern.mock.calls[0][0].searchPattern;
      const blPattern =
        mockRepo.fetchBudgetLinesByPattern.mock.calls[0][0].searchPattern;
      expect(txPattern).toBe(blPattern);
    });
  });

  describe('filter criteria', () => {
    it('should scope text and tag filters to budgets from selected years', async () => {
      mockRepo.fetchBudgetIdsByYears.mockResolvedValue([
        'budget-1',
        'budget-2',
      ]);

      await useCase.execute(
        { q: 'Courses', years: [2025, 2026], tagIds: ['tag-1'] },
        mockUser,
      );

      expect(mockRepo.fetchBudgetIdsByYears).toHaveBeenCalledWith(
        mockUser.id,
        [2025, 2026],
      );
      expect(mockRepo.fetchTransactionsByPattern).toHaveBeenCalledWith({
        userId: mockUser.id,
        searchPattern: '***=Courses',
        budgetIds: ['budget-1', 'budget-2'],
        tagIds: ['tag-1'],
      });
    });

    it('logs only aggregate diagnostics, never search, tag, or user values', async () => {
      const querySentinel = 'MARCHAND_ET_DETTE_SENTINEL';
      const tagSentinel = 'TAG_SENTINEL';
      const userSentinel = 'USER_SENTINEL';
      const user = { ...mockUser, id: userSentinel };

      mockRepo.fetchBudgetIdsByYears.mockResolvedValue(['budget-1']);
      mockRepo.fetchTransactionsByPattern.mockResolvedValue([
        {
          id: 'transaction-1',
          name: 'Result',
          amount: 'encrypted',
          kind: 'expense',
          transactionDate: '2026-01-01',
          budgetId: 'budget-1',
          budget: { description: 'Janvier', year: 2026, month: 1 },
        },
      ]);

      await useCase.execute(
        { q: querySentinel, years: [2026], tagIds: [tagSentinel] },
        user,
      );

      const serializedLog = JSON.stringify(mockLogger.info.mock.calls);
      expect(serializedLog).not.toContain(querySentinel);
      expect(serializedLog).not.toContain(tagSentinel);
      expect(serializedLog).not.toContain(userSentinel);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'transaction.search',
          resultCount: 1,
          years: [2026],
          durationMs: expect.any(Number),
        }),
        'Transactions searched',
      );
    });
  });
});
