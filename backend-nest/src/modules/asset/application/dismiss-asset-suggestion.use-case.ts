import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  ASSET_REPOSITORY,
  type AssetRepositoryPort,
} from '../domain/ports/asset-repository.port';
import type { Asset } from '../domain/asset.entity';

/**
 * Transitional route for the installed apps (iOS 1.14.x, Android) that still
 * show « Écarter »: the value follows what is checked, so there is nothing to
 * dismiss. It writes nothing and returns the asset. Remove it once no
 * installed version calls it.
 */
@Injectable()
export class DismissAssetSuggestionUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Asset> {
    const asset = (await this.repo.findAll()).find((a) => a.id === id);
    if (!asset) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ASSET_NOT_FOUND,
        { id },
        { operation: 'dismissAssetSuggestion', entityId: id, userId: user.id },
      );
    }
    return asset;
  }
}
