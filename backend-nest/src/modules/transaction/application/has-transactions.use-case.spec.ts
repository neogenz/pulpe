import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { HasTransactionsUseCase } from './has-transactions.use-case';
import { TRANSACTION_REPOSITORY } from '../domain/ports/transaction-repository.port';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('HasTransactionsUseCase', () => {
  let useCase: HasTransactionsUseCase;
  let mockRepo: { hasAnyTransaction: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = { hasAnyTransaction: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        HasTransactionsUseCase,
        { provide: TRANSACTION_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${HasTransactionsUseCase.name}`,
          useValue: { info() {}, debug() {}, warn() {}, trace() {} },
        },
      ],
    }).compile();

    useCase = module.get(HasTransactionsUseCase);
  });

  it('should report an account that has recorded a transaction', async () => {
    mockRepo.hasAnyTransaction.mockResolvedValue(true);

    expect(await useCase.execute(mockUser)).toBe(true);
  });

  it('should report an account that has recorded nothing yet', async () => {
    mockRepo.hasAnyTransaction.mockResolvedValue(false);

    expect(await useCase.execute(mockUser)).toBe(false);
  });
});
