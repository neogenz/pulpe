import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { CacheService } from '@modules/cache/cache.service';
import type { TagRepositoryPort } from '../domain/ports/tag-repository.port';
import { RemoveTagUseCase } from './remove-tag.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

describe('RemoveTagUseCase', () => {
  let repo: TagRepositoryPort;
  let cacheService: CacheService;
  let useCase: RemoveTagUseCase;

  beforeEach(() => {
    repo = {
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as TagRepositoryPort;
    cacheService = {
      invalidateForUser: jest.fn().mockResolvedValue(undefined),
    } as unknown as CacheService;
    useCase = new RemoveTagUseCase(repo, cacheService, {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
    });
  });

  it('deletes the tag and invalidates the budget cache', async () => {
    await useCase.execute('tag-1', user);

    expect(repo.delete).toHaveBeenCalledWith('tag-1');
    expect(cacheService.invalidateForUser).toHaveBeenCalledWith('user-1');
  });

  it('does not invalidate the cache when the delete fails', async () => {
    const failure = new Error('TAG_DELETE_FAILED');
    (repo.delete as ReturnType<typeof jest.fn>).mockRejectedValue(failure);

    await expect(useCase.execute('tag-1', user)).rejects.toThrow(failure);
    expect(cacheService.invalidateForUser).not.toHaveBeenCalled();
  });
});
