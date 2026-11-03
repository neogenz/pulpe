import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  ASSET_REPOSITORY,
  type AssetRepositoryPort,
} from '../domain/ports/asset-repository.port';
import type { Asset } from '../domain/asset.entity';

@Injectable()
export class DismissAssetSuggestionUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
    @InjectInfoLogger(DismissAssetSuggestionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  /**
   * Forgets every movement checked so far: the next suggestion only counts the
   * prévisions checked after this instant.
   */
  async execute(id: string, user: AuthenticatedUser): Promise<Asset> {
    const asset = await this.repo.update(id, {
      suggestionDismissedAt: new Date().toISOString(),
    });

    this.logger.info(
      { assetId: id, userId: user.id, operation: 'asset.dismissSuggestion' },
      'Asset suggestion dismissed',
    );
    return asset;
  }
}
