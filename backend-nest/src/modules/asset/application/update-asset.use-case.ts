import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AssetUpdate } from 'pulpe-shared';
import {
  ASSET_REPOSITORY,
  type AssetRepositoryPort,
} from '../domain/ports/asset-repository.port';
import type { Asset } from '../domain/asset.entity';

@Injectable()
export class UpdateAssetUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
    @InjectInfoLogger(UpdateAssetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: AssetUpdate,
    user: AuthenticatedUser,
  ): Promise<Asset> {
    const { archived, ...fields } = dto;
    const asset = await this.repo.update(id, {
      ...fields,
      ...(archived !== undefined && {
        archivedAt: archived ? new Date().toISOString() : null,
      }),
    });

    this.logger.info(
      { assetId: id, userId: user.id, operation: 'asset.update' },
      'Asset updated',
    );
    return asset;
  }
}
