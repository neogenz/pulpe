import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AssetSnapshotsCreate } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  ASSET_REPOSITORY,
  type AssetRepositoryPort,
} from '../domain/ports/asset-repository.port';
import { AssetInvariants } from '../domain/asset.invariants';

@Injectable()
export class RecordAssetSnapshotsUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
    @InjectInfoLogger(RecordAssetSnapshotsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  /** Returns the `recorded_at` shared by every snapshot of the batch. */
  async execute(
    dto: AssetSnapshotsCreate,
    user: AuthenticatedUser,
  ): Promise<string> {
    const assetsById = new Map(
      (await this.repo.findAll()).map((asset) => [asset.id, asset]),
    );
    for (const { assetId, value } of dto.items) {
      const asset = assetsById.get(assetId);
      if (!asset) {
        throw new BusinessException(
          ERROR_DEFINITIONS.ASSET_NOT_FOUND,
          { id: assetId },
          {
            operation: 'recordAssetSnapshots',
            entityId: assetId,
            userId: user.id,
          },
        );
      }
      AssetInvariants.validateValue(asset.direction, value);
    }

    const recordedAt = await this.repo.insertSnapshots(dto.items);

    this.logger.info(
      {
        count: dto.items.length,
        userId: user.id,
        operation: 'asset.recordSnapshots',
      },
      'Asset snapshots recorded',
    );
    return recordedAt;
  }
}
