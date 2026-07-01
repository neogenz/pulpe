import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { RemoveSavingsGoalUseCase } from './remove-savings-goal.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import { CacheService } from '@modules/cache/cache.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('RemoveSavingsGoalUseCase', () => {
  let useCase: RemoveSavingsGoalUseCase;
  let mockRepo: { delete: ReturnType<typeof jest.fn> };
  let mockCache: { invalidateForUser: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = { delete: jest.fn().mockResolvedValue(undefined) };
    mockCache = { invalidateForUser: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        RemoveSavingsGoalUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
        {
          provide: `INFO_LOGGER:${RemoveSavingsGoalUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(RemoveSavingsGoalUseCase);
  });

  it('invalidates the user cache after FK unlink side effects', async () => {
    await useCase.execute('goal-1', mockUser);

    expect(mockRepo.delete).toHaveBeenCalledWith('goal-1');
    expect(mockCache.invalidateForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('does not invalidate cache when delete fails', async () => {
    const error = new Error('delete failed');
    mockRepo.delete.mockRejectedValueOnce(error);

    await expect(useCase.execute('goal-1', mockUser)).rejects.toThrow(error);

    expect(mockCache.invalidateForUser).not.toHaveBeenCalled();
  });
});
