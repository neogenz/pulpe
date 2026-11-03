import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { UserModule } from '@modules/user/user.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { AssetController } from './infrastructure/http/asset.controller';
import { AssetCategoryController } from './infrastructure/http/asset-category.controller';
import { SupabaseAssetRepository } from './infrastructure/persistence/supabase-asset.repository';
import { CurrencyExchangeRateAdapter } from './infrastructure/adapters/currency-exchange-rate.adapter';
import { AssetMapper } from './infrastructure/mappers/asset.mapper';
import { ASSET_REPOSITORY } from './domain/ports/asset-repository.port';
import { EXCHANGE_RATE_PORT } from './domain/ports/exchange-rate.port';
import { GetNetWorthUseCase } from './application/get-net-worth.use-case';
import { CreateAssetUseCase } from './application/create-asset.use-case';
import { UpdateAssetUseCase } from './application/update-asset.use-case';
import { RemoveAssetUseCase } from './application/remove-asset.use-case';
import { RecordAssetSnapshotsUseCase } from './application/record-asset-snapshots.use-case';
import { CreateAssetCategoryUseCase } from './application/create-asset-category.use-case';
import { UpdateAssetCategoryUseCase } from './application/update-asset-category.use-case';
import { RemoveAssetCategoryUseCase } from './application/remove-asset-category.use-case';

@Module({
  // UserModule exports USER_REPOSITORY (base currency); CurrencyModule exports
  // the FX service, reached only through the exchange-rate adapter.
  imports: [SupabaseModule, EncryptionModule, UserModule, CurrencyModule],
  controllers: [AssetController, AssetCategoryController],
  providers: [
    GetNetWorthUseCase,
    CreateAssetUseCase,
    UpdateAssetUseCase,
    RemoveAssetUseCase,
    RecordAssetSnapshotsUseCase,
    CreateAssetCategoryUseCase,
    UpdateAssetCategoryUseCase,
    RemoveAssetCategoryUseCase,
    { provide: ASSET_REPOSITORY, useClass: SupabaseAssetRepository },
    { provide: EXCHANGE_RATE_PORT, useClass: CurrencyExchangeRateAdapter },
    AssetMapper,
    createInfoLoggerProvider(GetNetWorthUseCase.name),
    createInfoLoggerProvider(CreateAssetUseCase.name),
    createInfoLoggerProvider(UpdateAssetUseCase.name),
    createInfoLoggerProvider(RemoveAssetUseCase.name),
    createInfoLoggerProvider(RecordAssetSnapshotsUseCase.name),
    createInfoLoggerProvider(CreateAssetCategoryUseCase.name),
    createInfoLoggerProvider(UpdateAssetCategoryUseCase.name),
    createInfoLoggerProvider(RemoveAssetCategoryUseCase.name),
  ],
})
export class AssetModule {}
