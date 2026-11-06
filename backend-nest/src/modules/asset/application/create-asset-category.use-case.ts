import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AssetCategoryCreate } from 'pulpe-shared';
import {
  ASSET_REPOSITORY,
  type AssetRepositoryPort,
} from '../domain/ports/asset-repository.port';
import type { AssetCategory } from '../domain/asset.entity';

@Injectable()
export class CreateAssetCategoryUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
    @InjectInfoLogger(CreateAssetCategoryUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: AssetCategoryCreate,
    user: AuthenticatedUser,
  ): Promise<AssetCategory> {
    const category = await this.repo.insertCategory(dto.name);

    this.logger.info(
      {
        assetCategoryId: category.id,
        userId: user.id,
        operation: 'assetCategory.create',
      },
      'Asset category created',
    );
    return category;
  }
}
