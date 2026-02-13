import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
import { createInfoLoggerProvider } from '@common/logger/info-logger.provider';

@Global()
@Module({
  imports: [CacheModule.register({ ttl: 30_000 })],
  providers: [CacheService, createInfoLoggerProvider(CacheService.name)],
  exports: [CacheService],
})
export class AppCacheModule {}
