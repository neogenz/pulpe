import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AssetCreate } from 'pulpe-shared';
import {
  ASSET_REPOSITORY,
  type AssetRepositoryPort,
} from '../domain/ports/asset-repository.port';
import { AssetInvariants } from '../domain/asset.invariants';
import type { Asset } from '../domain/asset.entity';

@Injectable()
export class CreateAssetUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
    @InjectInfoLogger(CreateAssetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(dto: AssetCreate, user: AuthenticatedUser): Promise<Asset> {
    AssetInvariants.validateValue(dto.direction, dto.value);
    const asset = await this.repo.insertAsset(dto);

    this.logger.info(
      { assetId: asset.id, userId: user.id, operation: 'asset.create' },
      'Asset created',
    );
    return asset;
  }
}
