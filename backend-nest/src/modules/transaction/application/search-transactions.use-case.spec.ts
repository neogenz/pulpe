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

  describe('PostgREST-safe search pattern (HI-29)', () => {
    const executeQuery = (query: string) =>
      useCase.execute({ q: query }, mockUser);
    const transactionPattern = () =>
      mockRepo.fetchTransactionsByPattern.mock.calls[0][0].searchPattern;

    it('should wrap pattern in double quotes so commas do not break .or() parser', async () => {
      await executeQuery('hello, world');

      const pattern = transactionPattern();
      expect(pattern.startsWith('"')).toBe(true);
      expect(pattern.endsWith('"')).toBe(true);
      expect(pattern).toContain('hello, world');
    });

    it('should preserve a plain alphanumeric query inside the quoted wrapper', async () => {
      await executeQuery('Restaurant');

      const pattern = transactionPattern();
      expect(pattern).toBe('"*Restaurant*"');
    });

    it('should not crash on queries containing PostgREST reserved chars: , . : ( )', async () => {
      const queries = ['a, b', 'a.b.c', 'a:b', 'a(b)c', 'a, b.c: d (e)'];

      for (const q of queries) {
        await expect(executeQuery(q)).resolves.toEqual([]);
      }

      expect(mockRepo.fetchTransactionsByPattern).toHaveBeenCalledTimes(
        queries.length,
      );
      for (const call of mockRepo.fetchTransactionsByPattern.mock.calls) {
        const pattern = call[0].searchPattern;
        expect(pattern.startsWith('"')).toBe(true);
        expect(pattern.endsWith('"')).toBe(true);
      }
    });

    it('should escape backslash by doubling it inside the quoted value', async () => {
      await executeQuery('a\\b');

      const pattern = transactionPattern();
      expect(pattern).toBe('"*a\\\\b*"');
    });

    it('should escape an embedded double quote so the wrapper stays balanced', async () => {
      await executeQuery('say "hi"');

      const pattern = transactionPattern();
      // Internal " must become \" so the outer quote pair is unambiguous.
      expect(pattern).toBe('"*say \\"hi\\"*"');
    });

    it('should escape user-typed ILIKE wildcards (* and _) so they are treated literally', async () => {
      await executeQuery('100%_off*deal');

      const pattern = transactionPattern();
      // Outer * stay as ILIKE wildcards; user-typed * and _ are escaped with \.
      expect(pattern.startsWith('"*')).toBe(true);
      expect(pattern.endsWith('*"')).toBe(true);
      expect(pattern).toContain('\\*deal');
      expect(pattern).toContain('\\_off');
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
        searchPattern: '"*Courses*"',
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
