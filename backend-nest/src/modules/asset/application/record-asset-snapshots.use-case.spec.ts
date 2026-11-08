import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AssetRepositoryPort } from '../domain/ports/asset-repository.port';
import type { Asset } from '../domain/asset.entity';
import { RecordAssetSnapshotsUseCase } from './record-asset-snapshots.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

const account: Asset = {
  id: 'own-1',
  categoryId: 'cat-1',
  name: 'Compte UBS',
  currency: 'CHF',
  direction: 'own',
  inPulpe: true,
  archivedAt: null,
};
const leasing: Asset = {
  ...account,
  id: 'owe-1',
  name: 'Leasing',
  direction: 'owe',
};

describe('RecordAssetSnapshotsUseCase', () => {
  let repo: { findAll: jest.Mock; insertSnapshots: jest.Mock };
  let useCase: RecordAssetSnapshotsUseCase;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(async () => [account, leasing]),
      insertSnapshots: jest.fn(async () => '2026-11-03T10:00:00.000Z'),
    };
    useCase = new RecordAssetSnapshotsUseCase(
      repo as unknown as AssetRepositoryPort,
      { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), trace: jest.fn() },
    );
  });

  it('writes every item in one call and returns the shared recordedAt', async () => {
    const items = [
      { assetId: account.id, value: 1500 },
      { assetId: leasing.id, value: 7000 },
    ];

    const recordedAt = await useCase.execute({ items }, user);

    expect(repo.insertSnapshots).toHaveBeenCalledTimes(1);
    expect(repo.insertSnapshots).toHaveBeenCalledWith(items);
    expect(recordedAt).toBe('2026-11-03T10:00:00.000Z');
  });

  it('accepts a negative value on an own asset (overdraft)', async () => {
    await useCase.execute(
      { items: [{ assetId: account.id, value: -200 }] },
      user,
    );

    expect(repo.insertSnapshots).toHaveBeenCalledWith([
      { assetId: account.id, value: -200 },
    ]);
  });

  it('accepts zero on an owe asset (debt paid off)', async () => {
    await useCase.execute({ items: [{ assetId: leasing.id, value: 0 }] }, user);

    expect(repo.insertSnapshots).toHaveBeenCalledTimes(1);
  });

  it('refuses a negative value on an owe asset and writes nothing', async () => {
    const result = useCase.execute(
      {
        items: [
          { assetId: account.id, value: 10 },
          { assetId: leasing.id, value: -50 },
        ],
      },
      user,
    );

    await expect(result).rejects.toBeInstanceOf(BusinessException);
    await expect(result).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.ASSET_VALUE_INVALID.code,
    });
    expect(repo.insertSnapshots).not.toHaveBeenCalled();
  });

  it('refuses an asset the user does not own with ASSET_NOT_FOUND and writes nothing', async () => {
    const result = useCase.execute(
      {
        items: [
          { assetId: account.id, value: 10 },
          { assetId: 'someone-elses', value: 10 },
        ],
      },
      user,
    );

    await expect(result).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.ASSET_NOT_FOUND.code,
    });
    expect(repo.insertSnapshots).not.toHaveBeenCalled();
  });
});
