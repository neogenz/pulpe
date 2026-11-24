import { beforeEach, describe, expect, it } from 'bun:test';
import { Buffer } from 'node:buffer';
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

describe('DismissAssetSuggestionUseCase (CA18: installed apps)', () => {
  let useCase: DismissAssetSuggestionUseCase;

  beforeEach(() => {
    // Read-only repository: any write would throw, so a pass proves none ran.
    const repo: Pick<AssetRepositoryPort, 'findAll'> = {
      findAll: async () => [livret],
    };
    useCase = new DismissAssetSuggestionUseCase(repo as AssetRepositoryPort);
  });

  it('answers « Écarter » with the asset, unchanged, and writes nothing', async () => {
    const asset = await useCase.execute(livret.id, user);

    expect(asset).toEqual(livret);
  });

  it('answers ASSET_NOT_FOUND for an asset the user does not have', async () => {
    await expect(useCase.execute('other', user)).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.ASSET_NOT_FOUND.code,
    });
  });
});
