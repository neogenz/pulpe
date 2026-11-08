import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { CacheService } from '@modules/cache/cache.service';
import {
  ASSET_REPOSITORY,
  type AssetRepositoryPort,
} from '../domain/ports/asset-repository.port';

@Injectable()
export class RemoveAssetUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(RemoveAssetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<void> {
    await this.repo.delete(id);
    // The delete unlinks its prévisions (`ON DELETE SET NULL`): cached budget
    // details would still carry the asset id.
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { assetId: id, userId: user.id, operation: 'asset.remove' },
      'Asset deleted',
    );
  }
}
