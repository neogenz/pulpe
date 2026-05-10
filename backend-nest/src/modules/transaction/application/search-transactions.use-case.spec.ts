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

  beforeEach(async () => {
    mockRepo = {
      fetchTransactionsByPattern: jest.fn().mockResolvedValue([]),
      fetchBudgetLinesByPattern: jest.fn().mockResolvedValue([]),
      fetchBudgetIdsByYears: jest.fn().mockResolvedValue([]),
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
            info: () => {},
            debug: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(SearchTransactionsUseCase);
  });

  describe('PostgREST-safe search pattern (HI-29)', () => {
    it('should wrap pattern in double quotes so commas do not break .or() parser', async () => {
      await useCase.execute('hello, world', mockUser);

      const pattern = mockRepo.fetchTransactionsByPattern.mock.calls[0][0];
      expect(pattern.startsWith('"')).toBe(true);
      expect(pattern.endsWith('"')).toBe(true);
      expect(pattern).toContain('hello, world');
    });

    it('should preserve a plain alphanumeric query inside the quoted wrapper', async () => {
      await useCase.execute('Restaurant', mockUser);

      const pattern = mockRepo.fetchTransactionsByPattern.mock.calls[0][0];
      expect(pattern).toBe('"*Restaurant*"');
    });

    it('should not crash on queries containing PostgREST reserved chars: , . : ( )', async () => {
      const queries = ['a, b', 'a.b.c', 'a:b', 'a(b)c', 'a, b.c: d (e)'];

      for (const q of queries) {
        await expect(useCase.execute(q, mockUser)).resolves.toEqual([]);
      }

      expect(mockRepo.fetchTransactionsByPattern).toHaveBeenCalledTimes(
        queries.length,
      );
      for (const call of mockRepo.fetchTransactionsByPattern.mock.calls) {
        const pattern = call[0];
        expect(pattern.startsWith('"')).toBe(true);
        expect(pattern.endsWith('"')).toBe(true);
      }
    });

    it('should escape backslash by doubling it inside the quoted value', async () => {
      await useCase.execute('a\\b', mockUser);

      const pattern = mockRepo.fetchTransactionsByPattern.mock.calls[0][0];
      expect(pattern).toBe('"*a\\\\b*"');
    });

    it('should escape an embedded double quote so the wrapper stays balanced', async () => {
      await useCase.execute('say "hi"', mockUser);

      const pattern = mockRepo.fetchTransactionsByPattern.mock.calls[0][0];
      // Internal " must become \" so the outer quote pair is unambiguous.
      expect(pattern).toBe('"*say \\"hi\\"*"');
    });

    it('should escape user-typed ILIKE wildcards (* and _) so they are treated literally', async () => {
      await useCase.execute('100%_off*deal', mockUser);

      const pattern = mockRepo.fetchTransactionsByPattern.mock.calls[0][0];
      // Outer * stay as ILIKE wildcards; user-typed * and _ are escaped with \.
      expect(pattern.startsWith('"*')).toBe(true);
      expect(pattern.endsWith('*"')).toBe(true);
      expect(pattern).toContain('\\*deal');
      expect(pattern).toContain('\\_off');
    });

    it('should pass identical pattern to both transaction and budget-line repo calls', async () => {
      await useCase.execute('hello, world', mockUser);

      const txPattern = mockRepo.fetchTransactionsByPattern.mock.calls[0][0];
      const blPattern = mockRepo.fetchBudgetLinesByPattern.mock.calls[0][0];
      expect(txPattern).toBe(blPattern);
    });
  });
});
