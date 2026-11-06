import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AssetCategoryUpdate } from 'pulpe-shared';
import {
  ASSET_REPOSITORY,
  type AssetRepositoryPort,
} from '../domain/ports/asset-repository.port';
import type { AssetCategory } from '../domain/asset.entity';

@Injectable()
export class UpdateAssetCategoryUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
    @InjectInfoLogger(UpdateAssetCategoryUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: AssetCategoryUpdate,
    user: AuthenticatedUser,
  ): Promise<AssetCategory> {
    const category = await this.repo.updateCategory(id, dto.name);

    this.logger.info(
      {
        assetCategoryId: id,
        userId: user.id,
        operation: 'assetCategory.update',
      },
      'Asset category renamed',
    );
    return category;
  }
}
