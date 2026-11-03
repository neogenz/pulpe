import { Injectable } from '@nestjs/common';
import type {
  Asset as AssetApi,
  AssetCategory as AssetCategoryApi,
  AssetCategoryRecord,
  AssetRecord,
  NetWorth as NetWorthApi,
} from 'pulpe-shared';
import type {
  Asset,
  AssetCategory,
  NetWorth,
  NetWorthAsset,
  NetWorthCategory,
} from '../../domain/asset.entity';

@Injectable()
export class AssetMapper {
  toApi(entity: Asset): AssetRecord {
    return {
      id: entity.id,
      categoryId: entity.categoryId,
      name: entity.name,
      currency: entity.currency,
      direction: entity.direction,
      inPulpe: entity.inPulpe,
      archivedAt: entity.archivedAt,
    };
  }

  toCategoryApi(entity: AssetCategory): AssetCategoryRecord {
    return { id: entity.id, name: entity.name };
  }

  toNetWorthApi(netWorth: NetWorth): NetWorthApi {
    return {
      totals: netWorth.totals,
      categories: netWorth.categories.map((category) =>
        this.toNetWorthCategoryApi(category),
      ),
      assets: netWorth.assets.map((asset) => this.toNetWorthAssetApi(asset)),
    };
  }

  private toNetWorthCategoryApi(entity: NetWorthCategory): AssetCategoryApi {
    return { ...this.toCategoryApi(entity), total: entity.total };
  }

  private toNetWorthAssetApi(entity: NetWorthAsset): AssetApi {
    return {
      ...this.toApi(entity),
      latestValue: entity.latestValue,
      latestRecordedAt: entity.latestRecordedAt,
      convertedValue: entity.convertedValue,
      suggestion: entity.suggestion,
    };
  }
}
