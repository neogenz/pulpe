import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AssetRepositoryPort } from '../domain/ports/asset-repository.port';
import type { Asset } from '../domain/asset.entity';
import { DismissAssetSuggestionUseCase } from './dismiss-asset-suggestion.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

const livret: Asset = {
  id: 'livret-1',
  categoryId: 'cat-1',
  name: 'Livret',
  currency: 'CHF',
  direction: 'own',
  inPulpe: false,
  archivedAt: null,
};

describe('DismissAssetSuggestionUseCase', () => {
  let repo: { update: jest.Mock };
  let useCase: DismissAssetSuggestionUseCase;

  beforeEach(() => {
    repo = { update: jest.fn(async () => livret) };
    useCase = new DismissAssetSuggestionUseCase(
      repo as unknown as AssetRepositoryPort,
      { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), trace: jest.fn() },
    );
  });

  it('stamps the dismissal with the current instant and returns the asset', async () => {
    const before = Date.now();

    const asset = await useCase.execute(livret.id, user);

    expect(asset).toBe(livret);
    expect(repo.update).toHaveBeenCalledTimes(1);
    const [id, patch] = repo.update.mock.calls[0] as [
      string,
      { suggestionDismissedAt: string },
    ];
    expect(id).toBe(livret.id);
    expect(Object.keys(patch)).toEqual(['suggestionDismissedAt']);
    expect(Date.parse(patch.suggestionDismissedAt)).toBeGreaterThanOrEqual(
      before,
    );
    expect(Date.parse(patch.suggestionDismissedAt)).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it('lets ASSET_NOT_FOUND through for an asset of another user', async () => {
    repo.update.mockRejectedValue(
      new BusinessException(ERROR_DEFINITIONS.ASSET_NOT_FOUND, { id: 'other' }),
    );

    await expect(useCase.execute('other', user)).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.ASSET_NOT_FOUND.code,
    });
  });
});
