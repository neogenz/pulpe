import { describe, expect, it, mock } from 'bun:test';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { CacheService } from '@modules/cache/cache.service';
import type { AssetRepositoryPort } from '../domain/ports/asset-repository.port';
import { RemoveAssetUseCase } from './remove-asset.use-case';

describe('RemoveAssetUseCase', () => {
  it('should invalidate the user cache after deleting, since linked prévisions lose their asset', async () => {
    const calls: string[] = [];
    const repo = {
      delete: mock(async () => {
        calls.push('delete');
      }),
    } as unknown as AssetRepositoryPort;
    const cacheService = {
      invalidateForUser: mock(async () => {
        calls.push('invalidate');
      }),
    } as unknown as CacheService;
    const logger = { info: mock(() => undefined) };
    const useCase = new RemoveAssetUseCase(repo, cacheService, logger as never);

    await useCase.execute('asset-1', { id: 'user-1' } as AuthenticatedUser);

    expect(calls).toEqual(['delete', 'invalidate']);
    expect(cacheService.invalidateForUser).toHaveBeenCalledWith('user-1');
  });
});
